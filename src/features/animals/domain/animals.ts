import type { SanctuaryDb } from '@/shared/lib/db'
import { nextShelterId } from '@/shared/lib/ids/shelterId'
import type { AnimalRecord } from '@/features/sync/powersync/schema'
import { addTreatment } from '@/features/treatments/domain/treatments'
import {
  listAssignmentsForAnimal,
  replaceAnimalStatuses,
} from '@/features/statuses/domain/assignments'

export type CreateAnimalInput = {
  orgId: string
  prefix: string
  species: string
  statusIds: string[]
  name?: string
  sex?: string
  markings?: string
  notes?: string
  intakeDate?: string
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
  const now = new Date().toISOString()
  const intake_date = input.intakeDate ?? now.slice(0, 10)

  const notes = input.notes?.trim() || null

  await db.execute(
    `INSERT INTO animals (
      id, org_id, shelter_code, name, species, sex, markings,
      intake_date, status_id, notes, archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
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
    ],
  )

  await replaceAnimalStatuses(db, {
    orgId: input.orgId,
    animalId: id,
    statusIds: input.statusIds,
  })

  await addTreatment(db, {
    orgId: input.orgId,
    animalId: id,
    treatmentType: 'arrived',
    notes: notes ?? undefined,
    treatedAt: `${intake_date}T12:00:00.000Z`,
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
    markings: input.markings?.trim() || null,
    intake_date,
    status_id: created.status_id,
    notes,
    archived: 0,
    created_at: now,
    updated_at: now,
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

  return rows.map((row) => ({
    ...row,
    status_labels: labelsByAnimal.get(row.id) ?? [],
  }))
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
  return {
    ...animal,
    status_labels: assignments.map((assignment) => assignment.label),
  }
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
  statusIds: string[]
  name?: string
  sex?: string
  markings?: string
  notes?: string
  intakeDate?: string
}

/** Update editable animal profile fields. Shelter code stays immutable. */
export async function updateAnimal(
  db: SanctuaryDb,
  id: string,
  input: UpdateAnimalInput,
): Promise<void> {
  if (input.statusIds.length === 0) {
    throw new Error('At least one status is required.')
  }

  const existing = await getAnimal(db, id)
  if (!existing) throw new Error('Animal not found')

  const now = new Date().toISOString()
  const notes = input.notes?.trim() || null
  const intake_date =
    input.intakeDate ?? existing.intake_date ?? now.slice(0, 10)
  await db.execute(
    `UPDATE animals SET
      name = ?,
      species = ?,
      sex = ?,
      markings = ?,
      intake_date = ?,
      status_id = ?,
      notes = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.name?.trim() || null,
      input.species.trim(),
      input.sex?.trim() || null,
      input.markings?.trim() || null,
      intake_date,
      input.statusIds[0],
      notes,
      now,
      id,
    ],
  )

  if (!existing.org_id) throw new Error('Animal organization not found')
  await replaceAnimalStatuses(db, {
    orgId: existing.org_id,
    animalId: id,
    statusIds: input.statusIds,
  })

  // Keep the arrival care note in sync with intake date / notes.
  const arrivalRows = await db.getAll<{ id: string }>(
    `SELECT id FROM treatments
     WHERE animal_id = ? AND treatment_type IN ('arrived', 'intake')
     ORDER BY created_at ASC`,
    [id],
  )
  const arrivalId = arrivalRows[0]?.id
  if (arrivalId) {
    await db.execute(
      `UPDATE treatments SET notes = ?, treated_at = ?, treatment_type = 'arrived' WHERE id = ?`,
      [notes, `${intake_date}T12:00:00.000Z`, arrivalId],
    )
  } else if (existing.org_id) {
    await addTreatment(db, {
      orgId: existing.org_id,
      animalId: id,
      treatmentType: 'arrived',
      notes: notes ?? undefined,
      treatedAt: `${intake_date}T12:00:00.000Z`,
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
