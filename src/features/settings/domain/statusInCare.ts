import type { SanctuaryDb } from '@/shared/lib/db'
import { setStatusInCare } from '@/features/statuses/domain/statuses'

export async function countAnimalsWithStatusAndOthers(
  _db: SanctuaryDb,
  _statusId: string,
): Promise<number> {
  return 0
}

export async function setStatusOutOfCareWithStrip(
  db: SanctuaryDb,
  input: { statusId: string; stripOthers: boolean },
): Promise<void> {
  await setStatusInCare(db, input.statusId, false)
}

export async function applyCountsAsInCareChange(
  db: SanctuaryDb,
  input: { statusId: string; countsAsInCare: boolean },
): Promise<'ok' | 'needs_strip_confirm'> {
  await setStatusInCare(db, input.statusId, input.countsAsInCare)
  return 'ok'
}
