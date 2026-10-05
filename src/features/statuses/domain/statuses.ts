import type { SanctuaryDb } from '@/shared/lib/db'
import { supabase } from '@/shared/lib/supabase'

export type AnimalStatus = {
  id: string
  org_id: string
  label: string
  sort_order: number
  counts_as_in_care: number
  archived: number
  created_at: string
}

export type CreateStatusInput = {
  orgId: string
  label: string
  countsAsInCare?: boolean
}

export async function ensureDefaultStatuses(
  db: SanctuaryDb,
  orgId: string,
): Promise<AnimalStatus[]> {
  const existing = await db.getAll<AnimalStatus>(
    `SELECT * FROM animal_statuses WHERE org_id = ? AND archived = 0 ORDER BY sort_order ASC, label ASC`,
    [orgId],
  )
  if (existing.length > 0) return existing

  try {
    const { data } = await supabase
      .from('animal_statuses')
      .select('id, org_id, label, sort_order, counts_as_in_care, archived, created_at')
      .eq('org_id', orgId)
      .eq('archived', false)
      .order('sort_order', { ascending: true })

    if (data && data.length > 0) {
      if (db.writeTransaction) {
        await db.writeTransaction(async (tx) => {
          for (const s of data) {
            await tx.execute(
              `INSERT OR REPLACE INTO animal_statuses
                (id, org_id, label, sort_order, counts_as_in_care, archived, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                s.id,
                s.org_id,
                s.label,
                s.sort_order,
                s.counts_as_in_care ? 1 : 0,
                s.archived ? 1 : 0,
                s.created_at ?? new Date().toISOString(),
              ],
            )
          }
        })
      } else {
        for (const s of data) {
          await db.execute(
            `INSERT OR REPLACE INTO animal_statuses
              (id, org_id, label, sort_order, counts_as_in_care, archived, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id,
              s.org_id,
              s.label,
              s.sort_order,
              s.counts_as_in_care ? 1 : 0,
              s.archived ? 1 : 0,
              s.created_at ?? new Date().toISOString(),
            ],
          )
        }
      }
      return await db.getAll<AnimalStatus>(
        `SELECT * FROM animal_statuses WHERE org_id = ? AND archived = 0 ORDER BY sort_order ASC, label ASC`,
        [orgId],
      )
    }
  } catch (err) {
    console.warn('ensureDefaultStatuses: supabase fetch failed', err)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT OR REPLACE INTO animal_statuses (id, org_id, label, sort_order, counts_as_in_care, archived, created_at)
     VALUES (?, ?, 'Intake', 1, 1, 0, ?)`,
    [id, orgId, now],
  )

  void supabase
    .from('animal_statuses')
    .insert({
      id,
      org_id: orgId,
      label: 'Intake',
      sort_order: 1,
      counts_as_in_care: true,
      archived: false,
    })
    .then(({ error }) => {
      if (error) console.warn('ensureDefaultStatuses insert failed:', error.message)
    })

  return await db.getAll<AnimalStatus>(
    `SELECT * FROM animal_statuses WHERE org_id = ? AND archived = 0 ORDER BY sort_order ASC, label ASC`,
    [orgId],
  )
}

export async function listStatuses(
  db: SanctuaryDb,
  orgId: string,
  includeArchived = false,
): Promise<AnimalStatus[]> {
  if (includeArchived) {
    const all = await db.getAll<AnimalStatus>(
      `SELECT * FROM animal_statuses WHERE org_id = ? ORDER BY sort_order ASC`,
      [orgId],
    )
    if (all.length === 0) {
      return ensureDefaultStatuses(db, orgId)
    }
    return all
  }
  const active = await db.getAll<AnimalStatus>(
    `SELECT * FROM animal_statuses WHERE org_id = ? AND archived = 0 ORDER BY sort_order ASC`,
    [orgId],
  )
  if (active.length === 0) {
    return ensureDefaultStatuses(db, orgId)
  }
  return active
}

export async function createStatus(
  db: SanctuaryDb,
  input: CreateStatusInput,
): Promise<AnimalStatus> {
  const label = input.label.trim()
  const existing = await listStatuses(db, input.orgId, true)
  const duplicate = existing.some(
    (s) => s.label.trim().toLowerCase() === label.toLowerCase(),
  )
  if (duplicate) {
    throw new Error('That status already exists.')
  }
  const maxOrder = existing.reduce((m, s) => Math.max(m, s.sort_order), 0)
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  const counts_as_in_care = input.countsAsInCare === false ? 0 : 1
  const sort_order = maxOrder + 1

  await db.execute(
    `INSERT INTO animal_statuses (id, org_id, label, sort_order, counts_as_in_care, archived, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, input.orgId, label, sort_order, counts_as_in_care, created_at],
  )

  return {
    id,
    org_id: input.orgId,
    label,
    sort_order,
    counts_as_in_care,
    archived: 0,
    created_at,
  }
}

export async function renameStatus(
  db: SanctuaryDb,
  id: string,
  label: string,
): Promise<void> {
  await db.execute(`UPDATE animal_statuses SET label = ? WHERE id = ?`, [
    label.trim(),
    id,
  ])
}

export async function setStatusInCare(
  db: SanctuaryDb,
  id: string,
  countsAsInCare: boolean,
): Promise<void> {
  await db.execute(
    `UPDATE animal_statuses SET counts_as_in_care = ? WHERE id = ?`,
    [countsAsInCare ? 1 : 0, id],
  )
}

export async function reorderStatuses(
  db: SanctuaryDb,
  orderedIds: string[],
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.execute(
        `UPDATE animal_statuses SET sort_order = ? WHERE id = ?`,
        [i + 1, orderedIds[i]],
      )
    }
  })
}

export async function archiveStatus(
  db: SanctuaryDb,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE animal_statuses SET archived = 1 WHERE id = ?`, [id])
}
