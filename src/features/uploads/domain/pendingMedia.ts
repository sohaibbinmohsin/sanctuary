import type { SanctuaryDb } from '@/shared/lib/db'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { getLocalAttachment } from '@/features/ledger/domain/attachments'
import { formatPkr } from '@/features/ledger/domain/ledger'

export type PendingMediaKind = 'photo' | 'proof'
export type PendingMediaState = 'pending' | 'failed' | 'uploading'

export type PendingMediaItem = {
  id: string
  kind: PendingMediaKind
  state: PendingMediaState
  title: string
  subtitle: string
  href: string
  createdAt: string
}

type PhotoRow = {
  id: string
  animal_id: string
  upload_state: string
  created_at: string
  r2_key: string | null
  animal_name: string | null
  shelter_code: string
}

type ProofRow = {
  id: string
  ledger_entry_id: string
  upload_state: string
  created_at: string
  r2_key: string | null
  amount_cents: number
  direction: string
  entry_date: string
  notes: string | null
}

function asState(value: string): PendingMediaState {
  if (value === 'failed' || value === 'uploading') return value
  return 'pending'
}

export function pendingUploadsHeadline(count: number, failed: number): string {
  if (count <= 0) return 'Nothing waiting'
  if (failed > 0 && failed === count) {
    return count === 1 ? '1 couldn’t send' : `${count} couldn’t send`
  }
  if (failed > 0) {
    return `${count} waiting · ${failed} need a retry`
  }
  return count === 1 ? '1 waiting to send' : `${count} waiting to send`
}

export function pendingUploadsBody(online: boolean): string {
  if (!online) {
    return 'No internet right now. They stay on this phone until you are back online.'
  }
  return 'They send while this app is open. You can keep working.'
}

export async function listPendingMediaOnThisDevice(
  db: SanctuaryDb,
  orgId: string,
): Promise<PendingMediaItem[]> {
  const photos = await db.getAll<PhotoRow>(
    `SELECT p.id, p.animal_id, p.upload_state, p.created_at, p.r2_key,
            a.name as animal_name, a.shelter_code
     FROM photos p
     JOIN animals a ON a.id = p.animal_id
     WHERE p.org_id = ? AND p.upload_state IN ('pending', 'failed', 'uploading')
     ORDER BY p.created_at ASC`,
    [orgId],
  )
  const proofs = await db.getAll<ProofRow>(
    `SELECT att.id, att.ledger_entry_id, att.upload_state, att.created_at, att.r2_key,
            e.amount_cents, e.direction, e.entry_date, e.notes
     FROM ledger_attachments att
     JOIN ledger_entries e ON e.id = att.ledger_entry_id
     WHERE att.org_id = ?
       AND att.upload_state IN ('pending', 'failed', 'uploading')
     ORDER BY att.created_at ASC`,
    [orgId],
  )

  const items: PendingMediaItem[] = []

  for (const row of photos) {
    if (row.r2_key) continue
    if (!(await getLocalPhoto(row.id))) continue
    const name = row.animal_name?.trim() || row.shelter_code
    items.push({
      id: row.id,
      kind: 'photo',
      state: asState(row.upload_state),
      title: name,
      subtitle:
        row.upload_state === 'failed'
          ? 'Animal photo · couldn’t send'
          : 'Animal photo',
      href: `/animals/${row.animal_id}`,
      createdAt: row.created_at,
    })
  }

  for (const row of proofs) {
    if (row.r2_key) continue
    if (!(await getLocalAttachment(row.id))) continue
    const amount = formatPkr(row.amount_cents)
    const label = row.direction === 'in' ? `In ${amount}` : `Out ${amount}`
    items.push({
      id: row.id,
      kind: 'proof',
      state: asState(row.upload_state),
      title: label,
      subtitle:
        row.upload_state === 'failed'
          ? 'Ledger proof · couldn’t send'
          : 'Ledger proof',
      href: `/ledger/${row.ledger_entry_id}`,
      createdAt: row.created_at,
    })
  }

  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return items
}
