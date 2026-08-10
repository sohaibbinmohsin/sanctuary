import type { SanctuaryDb } from '@/shared/lib/db'

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

export async function listStatuses(
  db: SanctuaryDb,
  orgId: string,
  includeArchived = false,
): Promise<AnimalStatus[]> {
  if (includeArchived) {
    return db.getAll<AnimalStatus>(
      `SELECT * FROM animal_statuses WHERE org_id = ? ORDER BY sort_order ASC`,
      [orgId],
    )
  }
  return db.getAll<AnimalStatus>(
    `SELECT * FROM animal_statuses WHERE org_id = ? AND archived = 0 ORDER BY sort_order ASC`,
    [orgId],
  )
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
