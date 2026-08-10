import type { SanctuaryDb } from '@/shared/lib/db'
import { nextShelterId } from '@/shared/lib/ids/shelterId'
import type { AnimalRecord } from '@/features/sync/powersync/schema'
import { addTreatment } from '@/features/treatments/domain/treatments'

export type CreateAnimalInput = {
  orgId: string
  prefix: string
  species: string
  statusId: string
  name?: string
  sex?: string
  markings?: string
  notes?: string
  intakeDate?: string
}

export type AnimalSearchFilters = {
  query?: string
  statusId?: string
  species?: string
  /** Exact sex match; use `__unknown__` for blank/unknown sex. */
  sex?: string
}

export type AnimalWithStatus = AnimalRecord & {
  status_label?: string | null
}

export async function createAnimal(
  db: SanctuaryDb,
  input: CreateAnimalInput,
): Promise<AnimalRecord> {
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
      input.statusId,
      notes,
      now,
      now,
    ],
  )

  await addTreatment(db, {
    orgId: input.orgId,
    animalId: id,
    treatmentType: 'arrived',
    notes: notes ?? undefined,
    treatedAt: `${intake_date}T12:00:00.000Z`,
  })

  return {
    id,
    org_id: input.orgId,
    shelter_code,
    name: input.name?.trim() || null,
    species: input.species.trim(),
    sex: input.sex?.trim() || null,
    markings: input.markings?.trim() || null,
    intake_date,
    status_id: input.statusId,
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

  if (filters.statusId) {
    clauses.push('a.status_id = ?')
    params.push(filters.statusId)
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

  return db.getAll<AnimalWithStatus>(
    `SELECT a.*, s.label as status_label
     FROM animals a
     LEFT JOIN animal_statuses s ON s.id = a.status_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY a.intake_date DESC, a.shelter_code ASC`,
    params,
  )
}

export async function getAnimal(
  db: SanctuaryDb,
  id: string,
): Promise<AnimalWithStatus | null> {
  return db.getOptional<AnimalWithStatus>(
    `SELECT a.*, s.label as status_label
     FROM animals a
     LEFT JOIN animal_statuses s ON s.id = a.status_id
     WHERE a.id = ?`,
    [id],
  )
}

export async function updateAnimalStatus(
  db: SanctuaryDb,
  id: string,
  statusId: string,
): Promise<void> {
  const existing = await getAnimal(db, id)
  if (!existing) throw new Error('Animal not found')
  if (existing.status_id === statusId) return

  const status = await db.getOptional<{ label: string | null }>(
    `SELECT label FROM animal_statuses WHERE id = ?`,
    [statusId],
  )
  const now = new Date().toISOString()

  await db.execute(
    `UPDATE animals SET status_id = ?, updated_at = ? WHERE id = ?`,
    [statusId, now, id],
  )

  if (existing.org_id) {
    const label = status?.label?.trim() || 'Unknown status'
    const from = existing.status_label?.trim()
    await addTreatment(db, {
      orgId: existing.org_id,
      animalId: id,
      treatmentType: 'status',
      notes: from ? `${from} → ${label}` : label,
      treatedAt: now,
    })
  }
}

export type UpdateAnimalInput = {
  species: string
  statusId: string
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
  const existing = await getAnimal(db, id)
  if (!existing) throw new Error('Animal not found')

  const now = new Date().toISOString()
  const notes = input.notes?.trim() || null
  const intake_date =
    input.intakeDate ?? existing.intake_date ?? now.slice(0, 10)
  const statusChanged = input.statusId !== existing.status_id

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
      input.statusId,
      notes,
      now,
      id,
    ],
  )

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

  if (statusChanged && existing.org_id) {
    const status = await db.getOptional<{ label: string | null }>(
      `SELECT label FROM animal_statuses WHERE id = ?`,
      [input.statusId],
    )
    const label = status?.label?.trim() || 'Unknown status'
    const from = existing.status_label?.trim()
    await addTreatment(db, {
      orgId: existing.org_id,
      animalId: id,
      treatmentType: 'status',
      notes: from ? `${from} → ${label}` : label,
      treatedAt: now,
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
     JOIN animal_statuses s ON s.id = a.status_id
     WHERE a.org_id = ? AND a.archived = 0 AND s.counts_as_in_care = 1`,
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
    `SELECT a.status_id, s.label, s.sort_order, COUNT(*) as n
     FROM animals a
     LEFT JOIN animal_statuses s ON s.id = a.status_id
     WHERE a.org_id = ? AND a.archived = 0
     GROUP BY a.status_id, s.label, s.sort_order
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
