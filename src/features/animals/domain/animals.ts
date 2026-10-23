import type { SanctuaryDb } from '@/shared/lib/db'
import { nextShelterId } from '@/shared/lib/ids/shelterId'
import { localDateString } from '@/shared/lib/checklist/missedStreak'
import { arrivalTimestampFromIntakeDate } from '@/shared/lib/dates'
import type { AnimalRecord } from '@/features/sync/powersync/schema'
import { removeChecklistItemForAnimal } from '@/features/checklist/domain/checklist'
import { addTreatment } from '@/features/treatments/domain/treatments'
import {
  listAssignmentsForAnimal,
  replaceAnimalStatuses,
  setSingleStatusAssignment,
} from '@/features/statuses/domain/assignments'
import { listStatuses } from '@/features/statuses/domain/statuses'
import { queuePhoto } from '@/features/photos/domain/photos'

export function pickDefaultIntakeStatusId(
  statuses: readonly {
    id: string
    label?: string | null
    counts_as_in_care?: number | null
    archived?: number | null
  }[],
): string | null {
  const active = statuses.filter((s) => !s.archived)
  const pool = active.length > 0 ? active : statuses
  const intake = pool.find(
    (s) => s.label && s.label.trim().toLowerCase() === 'intake',
  )
  if (intake) return intake.id
  const firstInCare = pool.find((s) => s.counts_as_in_care === 1)
  if (firstInCare) return firstInCare.id
  return pool[0]?.id ?? null
}

export type AnimalLifeStage = 'adult' | 'child'
export type { AnimalRecord }

export type CreateAnimalInput = {
  orgId: string
  prefix: string
  species: string
  life_stage?: AnimalLifeStage
  lifeStage?: AnimalLifeStage
  statusIds: string[]
  name?: string
  sex?: string
  markings?: string
  notes?: string
  intakeDate?: string
  intakeTime?: string
  arrivalTimestamp?: string
}

export type AnimalSearchFilters = {
  query?: string
  statusIds?: string[]
  statusMode?: 'any' | 'all'
  species?: string
  /** Exact sex match; use `__unknown__` for blank/unknown sex. */
  sex?: string
}

export type AnimalWithStatus = AnimalRecord & {
  status_label?: string | null
  status_labels: string[]
}

export async function createAnimal(
  db: SanctuaryDb,
  input: CreateAnimalInput,
): Promise<AnimalRecord> {
  if (input.statusIds.length === 0) {
    throw new Error('At least one status is required.')
  }

  const codes = await db.getAll<{ shelter_code: string }>(
    `SELECT shelter_code FROM animals WHERE org_id = ?`,
    [input.orgId],
  )
  const shelter_code = nextShelterId(
    input.prefix,
    codes.map((c) => c.shelter_code),
  )
  const id = crypto.randomUUID()
  const nowDate = new Date()
  const now = nowDate.toISOString()
  const intake_date = input.intakeDate ?? localDateString(nowDate)

  const notes = input.notes?.trim() || null

  const life_stage: AnimalLifeStage = input.life_stage ?? input.lifeStage ?? 'adult'

  await db.execute(
    `INSERT INTO animals (
      id, org_id, shelter_code, name, species, sex, markings,
      intake_date, status_id, notes, archived, created_at, updated_at, life_stage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      input.orgId,
      shelter_code,
      input.name?.trim() || null,
      input.species.trim(),
      input.sex?.trim() || null,
      input.markings?.trim() || null,
      intake_date,
      input.statusIds[0],
      notes,
      now,
      now,
      life_stage,
    ],
  )

  await replaceAnimalStatuses(db, {
    orgId: input.orgId,
    animalId: id,
    statusIds: input.statusIds,
    skipTreatmentLog: true,
  })

  const treatedAt =
    input.arrivalTimestamp ??
    (input.intakeTime && intake_date
      ? `${intake_date}T${input.intakeTime}:00`
      : arrivalTimestampFromIntakeDate(intake_date, nowDate))

  await addTreatment(db, {
    orgId: input.orgId,
    animalId: id,
    treatmentType: 'arrived',
    notes: notes ?? undefined,
    treatedAt,
  })

  const created = await getAnimal(db, id)
  if (!created) throw new Error('Created animal not found')

  return {
    id,
    org_id: input.orgId,
    shelter_code,
    name: input.name?.trim() || null,
    species: input.species.trim(),
    sex: input.sex?.trim() || null,
    life_stage,
    markings: input.markings?.trim() || null,
    intake_date,
    status_id: created.status_id,
    notes,
    archived: 0,
    created_at: now,
    updated_at: now,
  }
}

export type CreateQuickAnimalStubInput = {
  orgId: string
  prefix: string
  photoBlob?: Blob
  captureSource?: 'camera' | 'gallery'
  captureToken?: string
  statusId?: string
}

export async function getNextShelterCode(
  db: SanctuaryDb,
  orgId: string,
  prefix: string,
): Promise<string> {
  const codes = await db.getAll<{ shelter_code: string }>(
    `SELECT shelter_code FROM animals WHERE org_id = ?`,
    [orgId],
  )
  return nextShelterId(
    prefix,
    codes.map((c) => c.shelter_code),
  )
}

export async function createQuickAnimalStub(
  db: SanctuaryDb,
  input: CreateQuickAnimalStubInput,
): Promise<{ animal: AnimalRecord; shelterCode: string }> {
  let statusId = input.statusId
  if (!statusId) {
    const statuses = await listStatuses(db, input.orgId)
    statusId = pickDefaultIntakeStatusId(statuses) ?? undefined
  }

  if (!statusId) {
    throw new Error('No animal status found to assign.')
  }

  const animal = await createAnimal(db, {
    orgId: input.orgId,
    prefix: input.prefix,
    species: 'Unknown',
    statusIds: [statusId],
    name: undefined,
    sex: undefined,
    markings: undefined,
  })

  if (input.photoBlob) {
    await queuePhoto(db, {
      orgId: input.orgId,
      animalId: animal.id,
      blob: input.photoBlob,
      captureSource: input.captureSource ?? 'camera',
      captureToken: input.captureToken,
    })
  }

  return {
    animal,
    shelterCode: animal.shelter_code ?? '',
  }
}

async function reconcileAnimalsWithTimelineStatuses(
  db: SanctuaryDb,
  orgId: string,
  animals: AnimalWithStatus[],
): Promise<AnimalWithStatus[]> {
  if (animals.length === 0 || !orgId) return animals
  try {
    const placeholders = animals.map(() => '?').join(', ')
    const animalIds = animals.map((a) => a.id)

    const [statusTreatments, arrivalRows, statuses] = await Promise.all([
      db.getAll<{
        animal_id: string
        notes: string | null
        treated_at: string | null
        created_at: string | null
      }>(
        `SELECT animal_id, notes, treated_at, created_at
         FROM treatments
         WHERE animal_id IN (${placeholders}) AND treatment_type = 'status'
         ORDER BY treated_at DESC, created_at DESC`,
        animalIds,
      ),
      db.getAll<{ animal_id: string }>(
        `SELECT DISTINCT animal_id
         FROM treatments
         WHERE animal_id IN (${placeholders}) AND treatment_type IN ('arrived', 'intake')`,
        animalIds,
      ),
      db.getAll<{ id: string; label: string }>(
        `SELECT id, label FROM animal_statuses WHERE org_id = ? AND archived = 0`,
        [orgId],
      ),
    ])

    if (!statuses || statuses.length === 0) return animals

    const statusByLowerLabel = new Map<string, { id: string; label: string }>()
    for (const s of statuses) {
      if (s.label) {
        statusByLowerLabel.set(s.label.trim().toLowerCase(), s)
      }
    }

    const latestStatusNoteByAnimal = new Map<string, string>()
    for (const t of statusTreatments ?? []) {
      if (!latestStatusNoteByAnimal.has(t.animal_id) && t.notes?.trim()) {
        latestStatusNoteByAnimal.set(t.animal_id, t.notes.trim())
      }
    }

    const hasArrivalSet = new Set((arrivalRows ?? []).map((r) => r.animal_id))
    const intakeStatus = statusByLowerLabel.get('intake')

    return animals.map((animal) => {
      const latestNote = latestStatusNoteByAnimal.get(animal.id)
      if (latestNote) {
        const candidateLabel = latestNote.includes(' - ')
          ? latestNote.split(' - ')[0]!.trim()
          : latestNote.trim()
        const matched = statusByLowerLabel.get(candidateLabel.toLowerCase())
        if (matched && animal.status_id !== matched.id) {
          void setSingleStatusAssignment(db, {
            orgId,
            animalId: animal.id,
            statusId: matched.id,
          }).catch(() => {})
          return {
            ...animal,
            status_id: matched.id,
            status_label: matched.label,
            status_labels: [matched.label],
          }
        }
      } else if (
        hasArrivalSet.has(animal.id) &&
        intakeStatus &&
        animal.status_label?.trim().toLowerCase() === 'quarantine' &&
        animal.status_id !== intakeStatus.id
      ) {
        void setSingleStatusAssignment(db, {
          orgId,
          animalId: animal.id,
          statusId: intakeStatus.id,
        }).catch(() => {})
        return {
          ...animal,
          status_id: intakeStatus.id,
          status_label: intakeStatus.label,
          status_labels: [intakeStatus.label],
        }
      }
      return animal
    })
  } catch {
    return animals
  }
}

export async function searchAnimals(
  db: SanctuaryDb,
  orgId: string,
  filters: AnimalSearchFilters = {},
): Promise<AnimalWithStatus[]> {
  const clauses = ['a.org_id = ?', 'a.archived = 0']
  const params: unknown[] = [orgId]

  const statusIds = [...new Set(filters.statusIds ?? [])]
  if (statusIds.length > 0) {
    const placeholders = statusIds.map(() => '?').join(', ')
    const matchAll =
      filters.statusMode === 'all'
        ? ` GROUP BY asa.animal_id
            HAVING COUNT(DISTINCT asa.status_id) = ?`
        : ''
    clauses.push(
      `a.id IN (
        SELECT asa.animal_id
        FROM animal_status_assignments asa
        WHERE asa.status_id IN (${placeholders})${matchAll}
      )`,
    )
    params.push(...statusIds)
    if (filters.statusMode === 'all') params.push(statusIds.length)
  }
  if (filters.species?.trim()) {
    clauses.push('LOWER(a.species) = LOWER(?)')
    params.push(filters.species.trim())
  }
  if (filters.sex === '__unknown__') {
    clauses.push("(a.sex IS NULL OR TRIM(IFNULL(a.sex, '')) = '')")
  } else if (filters.sex?.trim()) {
    clauses.push('LOWER(IFNULL(a.sex, \'\')) = LOWER(?)')
    params.push(filters.sex.trim())
  }
  if (filters.query?.trim()) {
    // SQLite string literals must use single quotes; "" is an identifier.
    clauses.push(
      '(LOWER(a.shelter_code) LIKE LOWER(?) OR LOWER(IFNULL(a.name, \'\')) LIKE LOWER(?))',
    )
    const q = `%${filters.query.trim()}%`
    params.push(q, q)
  }

  const rows = await db.getAll<Omit<AnimalWithStatus, 'status_labels'>>(
    `SELECT a.*, s.label as status_label
     FROM animals a
     LEFT JOIN animal_statuses s ON s.id = a.status_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY a.intake_date DESC, a.shelter_code ASC`,
    params,
  )
  if (rows.length === 0) return []

  const placeholders = rows.map(() => '?').join(', ')
  const labels = await db.getAll<{ animal_id: string; label: string }>(
    `SELECT asa.animal_id, s.label
     FROM animal_status_assignments asa
     JOIN animal_statuses s ON s.id = asa.status_id
     WHERE asa.animal_id IN (${placeholders})
     ORDER BY s.sort_order ASC, s.label ASC, s.id ASC`,
    rows.map((row) => row.id),
  )
  const labelsByAnimal = new Map<string, string[]>()
  for (const assignment of labels) {
    const animalLabels = labelsByAnimal.get(assignment.animal_id) ?? []
    animalLabels.push(assignment.label)
    labelsByAnimal.set(assignment.animal_id, animalLabels)
  }

  const enriched = rows.map((row) => ({
    ...row,
    status_labels: labelsByAnimal.get(row.id) ?? [],
  }))

  return reconcileAnimalsWithTimelineStatuses(db, orgId, enriched)
}

export async function getAnimal(
  db: SanctuaryDb,
  id: string,
): Promise<AnimalWithStatus | null> {
  const animal = await db.getOptional<Omit<AnimalWithStatus, 'status_labels'>>(
    `SELECT a.*, s.label as status_label
     FROM animals a
     LEFT JOIN animal_statuses s ON s.id = a.status_id
     WHERE a.id = ?`,
    [id],
  )
  if (!animal) return null

  const assignments = await listAssignmentsForAnimal(db, id)
  const enriched: AnimalWithStatus = {
    ...animal,
    status_labels: assignments.map((assignment) => assignment.label),
  }
  if (!animal.org_id) return enriched
  const [reconciled] = await reconcileAnimalsWithTimelineStatuses(
    db,
    animal.org_id,
    [enriched],
  )
  return reconciled ?? enriched
}

export async function updateAnimalStatus(
  db: SanctuaryDb,
  id: string,
  statusId: string,
): Promise<void> {
  const existing = await getAnimal(db, id)
  if (!existing) throw new Error('Animal not found')
  if (!existing.org_id) throw new Error('Animal organization not found')

  await replaceAnimalStatuses(db, {
    orgId: existing.org_id,
    animalId: id,
    statusIds: [statusId],
  })
}

export type UpdateAnimalInput = {
  species: string
  name?: string
  sex?: string
  life_stage?: AnimalLifeStage
  lifeStage?: AnimalLifeStage
  markings?: string
  /** When omitted, existing statuses are left unchanged. */
  statusIds?: string[]
  /** When omitted, animal notes and the arrival care note are left unchanged. */
  notes?: string
  /** When omitted, intake date and arrival timestamp are left unchanged. */
  intakeDate?: string
}

/** Update editable animal profile fields. Shelter code stays immutable. */
export async function updateAnimal(
  db: SanctuaryDb,
  id: string,
  input: UpdateAnimalInput,
): Promise<void> {
  if (input.statusIds && input.statusIds.length === 0) {
    throw new Error('At least one status is required.')
  }

  const existing = await getAnimal(db, id)
  if (!existing) throw new Error('Animal not found')

  const now = new Date().toISOString()
  const touchNotes = input.notes !== undefined
  const touchIntakeDate = input.intakeDate !== undefined
  const notes = touchNotes
    ? input.notes?.trim() || null
    : (existing.notes ?? null)
  const intake_date = touchIntakeDate
    ? (input.intakeDate ?? existing.intake_date ?? localDateString())
    : (existing.intake_date ?? localDateString())
  const intakeDateChanged = intake_date !== existing.intake_date
  const touchLifeStage =
    input.life_stage !== undefined || input.lifeStage !== undefined
  const life_stage: AnimalLifeStage = touchLifeStage
    ? (input.life_stage ?? input.lifeStage ?? 'adult')
    : (existing.life_stage ?? 'adult')

  await db.execute(
    `UPDATE animals SET
      name = ?,
      species = ?,
      sex = ?,
      life_stage = ?,
      markings = ?,
      intake_date = ?,
      notes = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.name?.trim() || null,
      input.species.trim(),
      input.sex?.trim() || null,
      life_stage,
      input.markings?.trim() || null,
      intake_date,
      notes,
      now,
      id,
    ],
  )

  if (!existing.org_id) throw new Error('Animal organization not found')
  if (input.statusIds) {
    await replaceAnimalStatuses(db, {
      orgId: existing.org_id,
      animalId: id,
      statusIds: input.statusIds,
    })
  }

  // Keep the arrival care note in sync only when arrival fields change.
  if (!touchNotes && !touchIntakeDate) return

  const arrivalRows = await db.getAll<{ id: string; treated_at: string }>(
    `SELECT id, treated_at FROM treatments
     WHERE animal_id = ? AND treatment_type IN ('arrived', 'intake')
     ORDER BY created_at ASC`,
    [id],
  )
  const arrival = arrivalRows[0]
  const arrivalTreatedAt = intakeDateChanged
    ? arrivalTimestampFromIntakeDate(intake_date)
    : (arrival?.treated_at ?? arrivalTimestampFromIntakeDate(intake_date))
  if (arrival) {
    await db.execute(
      `UPDATE treatments SET notes = ?, treated_at = ?, treatment_type = 'arrived' WHERE id = ?`,
      [notes, arrivalTreatedAt, arrival.id],
    )
  } else if (existing.org_id) {
    await addTreatment(db, {
      orgId: existing.org_id,
      animalId: id,
      treatmentType: 'arrived',
      notes: notes ?? undefined,
      treatedAt: arrivalTreatedAt,
    })
  }
}

/** Soft-delete: hides the animal from lists while keeping history syncable. */
export async function archiveAnimal(
  db: SanctuaryDb,
  id: string,
): Promise<void> {
  await db.execute(
    `UPDATE animals SET archived = 1, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  )
  await removeChecklistItemForAnimal(db, id)
}

export async function countInCare(
  db: SanctuaryDb,
  orgId: string,
): Promise<number> {
  const row = await db.getOptional<{ n: number }>(
    `SELECT COUNT(*) as n
     FROM animals a
     WHERE a.org_id = ? AND a.archived = 0
       AND EXISTS (
         SELECT 1
         FROM animal_status_assignments asa
         JOIN animal_statuses s ON s.id = asa.status_id
         WHERE asa.animal_id = a.id AND s.counts_as_in_care = 1
       )
       AND NOT EXISTS (
         SELECT 1
         FROM animal_status_assignments asa
         JOIN animal_statuses s ON s.id = asa.status_id
         WHERE asa.animal_id = a.id AND s.counts_as_in_care = 0
       )`,
    [orgId],
  )
  return row?.n ?? 0
}

export type StatusCount = {
  statusId: string
  label: string
  count: number
  sortOrder: number
}

/** Current (non-archived) animals grouped by status, ordered like Settings. */
export async function countAnimalsByStatus(
  db: SanctuaryDb,
  orgId: string,
): Promise<StatusCount[]> {
  const rows = await db.getAll<{
    status_id: string | null
    label: string | null
    sort_order: number | null
    n: number
  }>(
    `SELECT asa.status_id, s.label, s.sort_order, COUNT(*) as n
     FROM animals a
     JOIN animal_status_assignments asa ON asa.animal_id = a.id
     JOIN animal_statuses s ON s.id = asa.status_id
     WHERE a.org_id = ? AND a.archived = 0
     GROUP BY asa.status_id, s.label, s.sort_order
     ORDER BY COALESCE(s.sort_order, 999), s.label ASC`,
    [orgId],
  )

  return rows.map((r) => ({
    statusId: r.status_id ?? 'none',
    label: r.label?.trim() || 'No status',
    count: Number(r.n) || 0,
    sortOrder: r.sort_order ?? 999,
  }))
}

export type AnimalLifeStageCount = {
  adult: number
  child: number
}

export async function countAnimalsByLifeStage(
  db: SanctuaryDb,
  orgId: string,
): Promise<AnimalLifeStageCount> {
  const rows = await db.getAll<{ life_stage: string | null; count: number }>(
    `SELECT life_stage, COUNT(*) as count
     FROM animals
     WHERE org_id = ? AND archived = 0
     GROUP BY life_stage`,
    [orgId],
  ).catch(() => [])

  let adult = 0
  let child = 0
  for (const row of rows) {
    if (row.life_stage === 'child') child += Number(row.count) || 0
    else adult += Number(row.count) || 0
  }
  return { adult, child }
}

export type AnimalSpeciesCount = {
  species: string
  count: number
  adultCount: number
  childCount: number
}

export async function countAnimalsBySpecies(
  db: SanctuaryDb,
  orgId: string,
): Promise<AnimalSpeciesCount[]> {
  const rows = await db.getAll<{
    species: string
    count: number
    child_count: number
    adult_count: number
  }>(
    `SELECT
       species,
       COUNT(*) as count,
       SUM(CASE WHEN life_stage = 'child' THEN 1 ELSE 0 END) as child_count,
       SUM(CASE WHEN life_stage != 'child' OR life_stage IS NULL THEN 1 ELSE 0 END) as adult_count
     FROM animals
     WHERE org_id = ? AND archived = 0
     GROUP BY species
     ORDER BY count DESC`,
    [orgId],
  ).catch(() => [])

  return rows.map((r) => ({
    species: r.species?.trim() || 'Unknown',
    count: Number(r.count) || 0,
    adultCount: Number(r.adult_count) || 0,
    childCount: Number(r.child_count) || 0,
  }))
}


