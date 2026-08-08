import type { SanctuaryDb } from '@/shared/lib/db'
import { nextShelterId } from '@/shared/lib/ids/shelterId'
import type { AnimalRecord } from '@/features/sync/powersync/schema'

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
      input.notes?.trim() || null,
      now,
      now,
    ],
  )

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
    notes: input.notes?.trim() || null,
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
  await db.execute(
    `UPDATE animals SET status_id = ?, updated_at = ? WHERE id = ?`,
    [statusId, new Date().toISOString(), id],
  )
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
