import type { SanctuaryDb } from '@/shared/lib/db'
import { replaceAnimalStatuses } from '@/features/statuses/domain/assignments'
import { setStatusInCare } from '@/features/statuses/domain/statuses'

export async function countAnimalsWithStatusAndOthers(
  db: SanctuaryDb,
  statusId: string,
): Promise<number> {
  const row = await db.getOptional<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM animal_status_assignments target
     WHERE target.status_id = ?
       AND EXISTS (
         SELECT 1
         FROM animal_status_assignments other
         WHERE other.animal_id = target.animal_id
           AND other.status_id != target.status_id
       )`,
    [statusId],
  )
  return row?.n ?? 0
}

export async function setStatusOutOfCareWithStrip(
  db: SanctuaryDb,
  input: { statusId: string; stripOthers: boolean },
): Promise<void> {
  if (input.stripOthers) {
    const status = await db.getOptional<{ org_id: string }>(
      `SELECT org_id FROM animal_statuses WHERE id = ?`,
      [input.statusId],
    )
    if (!status) {
      throw new Error('Status not found.')
    }

    const animals = await db.getAll<{ animal_id: string }>(
      `SELECT target.animal_id
       FROM animal_status_assignments target
       WHERE target.status_id = ?
         AND EXISTS (
           SELECT 1
           FROM animal_status_assignments other
           WHERE other.animal_id = target.animal_id
             AND other.status_id != target.status_id
         )`,
      [input.statusId],
    )

    for (const { animal_id } of animals) {
      await replaceAnimalStatuses(db, {
        orgId: status.org_id,
        animalId: animal_id,
        statusIds: [input.statusId],
      })
    }
  }

  await setStatusInCare(db, input.statusId, false)
}

export async function applyCountsAsInCareChange(
  db: SanctuaryDb,
  input: { statusId: string; countsAsInCare: boolean },
): Promise<'ok' | 'needs_strip_confirm'> {
  if (input.countsAsInCare) {
    await setStatusInCare(db, input.statusId, true)
    return 'ok'
  }

  const count = await countAnimalsWithStatusAndOthers(db, input.statusId)
  if (count > 0) {
    return 'needs_strip_confirm'
  }

  await setStatusInCare(db, input.statusId, false)
  return 'ok'
}
