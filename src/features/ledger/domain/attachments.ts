import type { SanctuaryDb } from '@/shared/lib/db'
import type { LedgerAttachmentRecord } from '@/features/sync/powersync/schema'
import {
  compressImage,
  publicPhotoUrl,
  requestR2Delete,
  r2ObjectKey,
} from '@/shared/lib/r2/upload'
import { notifyPendingMediaChanged } from '@/shared/lib/pendingMedia'

const ATTACHMENT_CACHE = 'sanctuary-ledger-attachments-v1'

async function attachmentStore(): Promise<Cache> {
  return caches.open(ATTACHMENT_CACHE)
}

export function localAttachmentUrl(attachmentId: string): string {
  return `/__local_ledger_attachments__/${attachmentId}`
}

export function ledgerAttachmentObjectKey(input: {
  orgId: string
  entryId: string
  attachmentId: string
}): string {
  return `${input.orgId}/ledger/${input.entryId}/${input.attachmentId}.jpg`
}

export async function storeLocalAttachment(
  attachmentId: string,
  blob: Blob,
): Promise<void> {
  const cache = await attachmentStore()
  await cache.put(
    localAttachmentUrl(attachmentId),
    new Response(blob, {
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
    }),
  )
}

export async function getLocalAttachment(
  attachmentId: string,
): Promise<Blob | null> {
  const cache = await attachmentStore()
  const res = await cache.match(localAttachmentUrl(attachmentId))
  if (!res) return null
  return res.blob()
}

export async function deleteLocalAttachment(
  attachmentId: string,
): Promise<void> {
  const cache = await attachmentStore()
  await cache.delete(localAttachmentUrl(attachmentId))
}

async function deleteRemoteAttachment(
  attachment: LedgerAttachmentRecord,
): Promise<void> {
  const uploaded =
    attachment.upload_state === 'uploaded' || Boolean(attachment.r2_key)
  if (!uploaded) return
  if (!navigator.onLine) {
    throw new Error(
      'Connect to the internet to delete proof from cloud storage.',
    )
  }
  const key =
    r2ObjectKey(attachment.r2_key) ??
    (attachment.org_id && attachment.ledger_entry_id
      ? ledgerAttachmentObjectKey({
          orgId: attachment.org_id,
          entryId: attachment.ledger_entry_id,
          attachmentId: attachment.id,
        })
      : null)
  if (!key) return
  await requestR2Delete(key)
}

export async function deleteLedgerAttachment(
  db: SanctuaryDb,
  attachmentId: string,
): Promise<void> {
  const attachment = await db.getOptional<LedgerAttachmentRecord>(
    `SELECT * FROM ledger_attachments WHERE id = ?`,
    [attachmentId],
  )
  if (attachment) {
    await deleteRemoteAttachment(attachment)
  }
  await deleteLocalAttachment(attachmentId)
  await db.execute(`DELETE FROM ledger_attachments WHERE id = ?`, [
    attachmentId,
  ])
}

export async function deleteAttachmentsForEntry(
  db: SanctuaryDb,
  entryId: string,
): Promise<void> {
  const rows = await db.getAll<LedgerAttachmentRecord>(
    `SELECT * FROM ledger_attachments WHERE ledger_entry_id = ?`,
    [entryId],
  )
  for (const row of rows) {
    await deleteLedgerAttachment(db, row.id)
  }
}

/** Drop queued uploads whose ledger entry no longer exists. */
export async function purgeOrphanedPendingAttachments(
  db: SanctuaryDb,
): Promise<number> {
  const orphans = await db.getAll<{ id: string }>(
    `SELECT a.id FROM ledger_attachments a
     LEFT JOIN ledger_entries e ON e.id = a.ledger_entry_id
     WHERE a.upload_state IN ('pending', 'failed', 'uploading')
       AND e.id IS NULL`,
  )
  for (const row of orphans) {
    await deleteLedgerAttachment(db, row.id)
  }
  return orphans.length
}

export async function queueLedgerAttachment(
  db: SanctuaryDb,
  input: { orgId: string; entryId: string; blob: Blob },
): Promise<LedgerAttachmentRecord> {
  const compressed = await compressImage(input.blob)
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await storeLocalAttachment(id, compressed)
  await db.execute(
    `INSERT INTO ledger_attachments (
      id, org_id, ledger_entry_id, r2_key, local_only, upload_state, created_at
    ) VALUES (?, ?, ?, NULL, 1, 'pending', ?)`,
    [id, input.orgId, input.entryId, created_at],
  )

  notifyPendingMediaChanged()

  return {
    id,
    org_id: input.orgId,
    ledger_entry_id: input.entryId,
    r2_key: null,
    local_only: 1,
    upload_state: 'pending',
    created_at,
  }
}

export async function countPendingAttachments(
  db: SanctuaryDb,
  orgId: string,
  entryId?: string,
): Promise<number> {
  if (entryId) {
    const row = await db.getOptional<{ n: number }>(
      `SELECT COUNT(*) as n FROM ledger_attachments
       WHERE org_id = ? AND ledger_entry_id = ? AND upload_state IN ('pending', 'failed')`,
      [orgId, entryId],
    )
    return row?.n ?? 0
  }
  const row = await db.getOptional<{ n: number }>(
    `SELECT COUNT(*) as n FROM ledger_attachments
     WHERE org_id = ? AND upload_state IN ('pending', 'failed')`,
    [orgId],
  )
  return row?.n ?? 0
}

export async function listAttachmentsForEntry(
  db: SanctuaryDb,
  entryId: string,
): Promise<LedgerAttachmentRecord[]> {
  return db.getAll<LedgerAttachmentRecord>(
    `SELECT * FROM ledger_attachments WHERE ledger_entry_id = ? ORDER BY created_at ASC`,
    [entryId],
  )
}

export async function listAttachmentsForOrg(
  db: SanctuaryDb,
  orgId: string,
): Promise<LedgerAttachmentRecord[]> {
  return db.getAll<LedgerAttachmentRecord>(
    `SELECT * FROM ledger_attachments WHERE org_id = ? ORDER BY created_at ASC`,
    [orgId],
  )
}

export async function resolveAttachmentUrl(
  attachment: LedgerAttachmentRecord,
): Promise<string | null> {
  const remote = publicPhotoUrl(attachment.r2_key)
  if (remote) return remote
  const local = await getLocalAttachment(attachment.id)
  if (local) return URL.createObjectURL(local)
  // No cloud URL and no local bytes — nothing useful to show.
  return null
}

let attachmentQueueRunning: Promise<{ uploaded: number; failed: number }> | null =
  null

/** Reset rows left mid-upload (tab close / race) so they can retry. */
export async function recoverStaleUploadingAttachments(
  db: SanctuaryDb,
): Promise<number> {
  const stale = await db.getAll<{ id: string; r2_key: string | null }>(
    `SELECT id, r2_key FROM ledger_attachments WHERE upload_state = 'uploading'`,
  )
  let recovered = 0
  for (const row of stale) {
    if (row.r2_key) {
      await db.execute(
        `UPDATE ledger_attachments SET upload_state = 'uploaded', local_only = 0 WHERE id = ?`,
        [row.id],
      )
    } else {
      await db.execute(
        `UPDATE ledger_attachments SET upload_state = 'pending' WHERE id = ?`,
        [row.id],
      )
    }
    recovered += 1
  }
  return recovered
}

export async function processLedgerAttachmentQueue(
  db: SanctuaryDb,
): Promise<{ uploaded: number; failed: number }> {
  if (attachmentQueueRunning) return attachmentQueueRunning

  attachmentQueueRunning = (async () => {
    await recoverStaleUploadingAttachments(db)
    await purgeOrphanedPendingAttachments(db)
    const { requestSignedUpload } = await import('@/shared/lib/r2/upload')
    const pending = await db.getAll<LedgerAttachmentRecord>(
      `SELECT * FROM ledger_attachments
       WHERE upload_state IN ('pending', 'failed')
       ORDER BY created_at ASC LIMIT 10`,
    )

    let uploaded = 0
    let failed = 0

    for (const attachment of pending) {
      try {
        await db.execute(
          `UPDATE ledger_attachments SET upload_state = 'uploading' WHERE id = ?`,
          [attachment.id],
        )
        const blob = await getLocalAttachment(attachment.id)
        if (!blob) {
          throw new Error(`Local attachment missing for ${attachment.id}`)
        }
        if (!attachment.org_id || !attachment.ledger_entry_id) {
          throw new Error(
            `Attachment ${attachment.id} is missing org or entry id`,
          )
        }
        const key = ledgerAttachmentObjectKey({
          orgId: attachment.org_id,
          entryId: attachment.ledger_entry_id,
          attachmentId: attachment.id,
        })
        const { uploadUrl, publicUrl } = await requestSignedUpload(key)
        const put = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
        })
        if (!put.ok) {
          const detail = (await put.text().catch(() => '')).slice(0, 200)
          throw new Error(
            `R2 upload failed: ${put.status}${detail ? ` ${detail}` : ''}`,
          )
        }
        await db.execute(
          `UPDATE ledger_attachments SET r2_key = ?, local_only = 0, upload_state = 'uploaded' WHERE id = ?`,
          [publicUrl || key, attachment.id],
        )
        uploaded += 1
      } catch (err) {
        console.warn('Ledger attachment upload failed:', err)
        await db.execute(
          `UPDATE ledger_attachments SET upload_state = 'failed' WHERE id = ?`,
          [attachment.id],
        )
        failed += 1
      }
    }

    return { uploaded, failed }
  })()

  try {
    return await attachmentQueueRunning
  } finally {
    attachmentQueueRunning = null
    notifyPendingMediaChanged()
  }
}
