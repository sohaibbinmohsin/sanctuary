import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@powersync/react'
import { X } from '@phosphor-icons/react'
import type { LedgerAttachmentRecord } from '@/features/sync/powersync/schema'
import { resolveAttachmentUrl } from '@/features/ledger/domain/attachments'

type ProofItem = {
  attachment: LedgerAttachmentRecord
  url: string
}

const EMPTY: LedgerAttachmentRecord[] = []

type EntryProofThumbsProps = {
  entryId: string
  /** Preloaded org attachments — avoids one query per row. */
  attachments: LedgerAttachmentRecord[]
}

export function EntryProofThumbs({
  entryId,
  attachments,
}: EntryProofThumbsProps) {
  const rows = useMemo(
    () => attachments.filter((a) => a.ledger_entry_id === entryId),
    [attachments, entryId],
  )
  const [items, setItems] = useState<ProofItem[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []
    void (async () => {
      const next: ProofItem[] = []
      for (const attachment of rows) {
        const url = await resolveAttachmentUrl(attachment)
        if (!url) continue
        if (url.startsWith('blob:')) objectUrls.push(url)
        next.push({ attachment, url })
      }
      if (!cancelled) setItems(next)
    })()
    return () => {
      cancelled = true
      for (const url of objectUrls) URL.revokeObjectURL(url)
    }
  }, [rows])

  if (items.length === 0) return null

  const viewer = viewerIndex != null ? items[viewerIndex] : null

  return (
    <>
      <div className="proof-strip" aria-label="Attached proof">
        {items.map(({ attachment, url }, index) => (
          <div className="proof-strip__item" key={attachment.id}>
            <button
              type="button"
              className="proof-strip__thumb"
              style={{ backgroundImage: `url(${url})` }}
              aria-label={`View proof ${index + 1}`}
              onClick={() => setViewerIndex(index)}
            />
          </div>
        ))}
      </div>

      {viewer ? (
        <div
          className="proof-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Proof preview"
          onClick={() => setViewerIndex(null)}
        >
          <button
            type="button"
            className="proof-viewer__close"
            aria-label="Close"
            onClick={() => setViewerIndex(null)}
          >
            <X size={22} weight="bold" aria-hidden />
          </button>
          <img
            src={viewer.url}
            alt="Ledger entry proof"
            className="proof-viewer__img"
            onClick={(e) => e.stopPropagation()}
          />
          {items.length > 1 ? (
            <p className="proof-viewer__meta muted">
              {(viewerIndex ?? 0) + 1} of {items.length}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/** Live attachment rows for an org — use once on the Money list. */
export function useOrgAttachments(orgId: string | undefined) {
  const { data } = useQuery<LedgerAttachmentRecord>(
    orgId
      ? `SELECT * FROM ledger_attachments WHERE org_id = ? ORDER BY created_at ASC`
      : `SELECT * FROM ledger_attachments WHERE 0`,
    orgId ? [orgId] : [],
  )
  return data ?? EMPTY
}
