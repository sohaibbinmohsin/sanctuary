import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@powersync/react'
import { Camera, ImageSquare, Trash, X } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCanTakePhoto } from '@/shared/hooks/useCanTakePhoto'
import type { LedgerAttachmentRecord } from '@/features/sync/powersync/schema'
import {
  countPendingAttachments,
  deleteLedgerAttachment,
  processLedgerAttachmentQueue,
  queueLedgerAttachment,
  resolveAttachmentUrl,
} from '@/features/ledger/domain/attachments'
import { Button } from '@/shared/ui/Button'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import { isPlaygroundMode } from '@/features/playground/mode'

const EMPTY_FILES: File[] = []
const EMPTY_ATTACHMENTS: LedgerAttachmentRecord[] = []

type ProofItem = {
  attachment: LedgerAttachmentRecord
  url: string
}

type ProofCaptureProps = {
  orgId: string
  /** When set, files are queued immediately and existing proof is shown. */
  entryId?: string
  /** Local previews before the entry exists (create form). */
  pendingFiles?: File[]
  onPendingFilesChange?: (files: File[]) => void
  onQueued?: () => void
  label?: string
}

export function ProofCapture({
  orgId,
  entryId,
  pendingFiles = EMPTY_FILES,
  onPendingFilesChange,
  onQueued,
  label = 'Proof',
}: ProofCaptureProps) {
  const db = useDb()
  const confirm = useConfirm()
  const canTakePhoto = useCanTakePhoto()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [savedItems, setSavedItems] = useState<ProofItem[]>([])
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  const { data } = useQuery<LedgerAttachmentRecord>(
    entryId
      ? `SELECT * FROM ledger_attachments WHERE ledger_entry_id = ? ORDER BY created_at ASC`
      : `SELECT * FROM ledger_attachments WHERE 0`,
    entryId ? [entryId] : [],
  )
  const rows = data ?? EMPTY_ATTACHMENTS

  async function refreshPending() {
    if (!db || !entryId) {
      setPendingUpload(0)
      return
    }
    setPendingUpload(await countPendingAttachments(db, orgId, entryId))
  }

  useEffect(() => {
    void refreshPending()
  }, [db, orgId, entryId])

  useEffect(() => {
    if (pendingFiles.length === 0) {
      setPreviewUrls((current) => (current.length === 0 ? current : []))
      return
    }
    const urls = pendingFiles.map((f) => URL.createObjectURL(f))
    setPreviewUrls(urls)
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [pendingFiles])

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
      if (!cancelled) setSavedItems(next)
    })()
    return () => {
      cancelled = true
      for (const url of objectUrls) URL.revokeObjectURL(url)
    }
  }, [rows])

  useEffect(() => {
    if (!db || !entryId || isPlaygroundMode()) return
    const tick = () => {
      if (navigator.onLine) {
        void processLedgerAttachmentQueue(db).then(() => refreshPending())
      }
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    window.addEventListener('online', tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('online', tick)
    }
  }, [db, orgId, entryId])

  async function onFiles(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length) return
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) {
      setError('Choose a photo or receipt image.')
      if (input) input.value = ''
      return
    }

    setBusy(true)
    setError(null)
    try {
      if (entryId && db) {
        for (const file of images) {
          await queueLedgerAttachment(db, { orgId, entryId, blob: file })
        }
        if (!isPlaygroundMode() && navigator.onLine) {
          await processLedgerAttachmentQueue(db)
        }
        await refreshPending()
        onQueued?.()
      } else if (onPendingFilesChange) {
        onPendingFilesChange([...pendingFiles, ...images])
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save proof. Try again.',
      )
    } finally {
      setBusy(false)
      if (input) input.value = ''
    }
  }

  function removePending(index: number) {
    if (!onPendingFilesChange) return
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index))
  }

  async function onDeleteSaved(attachmentId: string) {
    if (!db) return
    const ok = await confirm({
      title: 'Delete this proof?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete proof',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteLedgerAttachment(db, attachmentId)
      setViewerUrl(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete proof. Try again.',
      )
    }
  }

  const viewerItem = savedItems.find((i) => i.url === viewerUrl)

  return (
    <div className="stack">
      <div className="field">
        <span>
          {label}
          <span className="field__hint"> · optional · receipt or photo</span>
        </span>
      </div>
      {canTakePhoto ? (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void onFiles(e.target.files, cameraRef.current)}
        />
      ) : null}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files, galleryRef.current)}
      />
      <div className="row">
        {canTakePhoto ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera size={18} weight="bold" aria-hidden />
            {busy ? 'Saving…' : 'Take photo'}
          </Button>
        ) : null}
        <Button
          type="button"
          variant={canTakePhoto ? 'ghost' : 'secondary'}
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          <ImageSquare size={18} weight="bold" aria-hidden />
          {busy ? 'Saving…' : canTakePhoto ? 'From gallery' : 'Add photo'}
        </Button>
        {pendingUpload > 0 ? (
          <span className="muted">{pendingUpload} waiting to upload</span>
        ) : null}
      </div>

      {savedItems.length > 0 || previewUrls.length > 0 ? (
        <div className="proof-strip" aria-label="Selected proof">
          {savedItems.map(({ attachment, url }) => (
            <div className="proof-strip__item" key={attachment.id}>
              <button
                type="button"
                className="proof-strip__thumb"
                style={{ backgroundImage: `url(${url})` }}
                aria-label="View proof"
                onClick={() => setViewerUrl(url)}
              />
              {attachment.upload_state === 'pending' ||
              attachment.upload_state === 'failed' ||
              attachment.upload_state === 'uploading' ? (
                <span className="proof-strip__badge muted">
                  {attachment.upload_state === 'failed' ? 'Retry' : '…'}
                </span>
              ) : null}
            </div>
          ))}
          {previewUrls.map((url, index) => (
            <div className="proof-strip__item" key={`pending-${index}`}>
              <button
                type="button"
                className="proof-strip__thumb"
                style={{ backgroundImage: `url(${url})` }}
                aria-label={`Proof ${index + 1}`}
              />
              <button
                type="button"
                className="proof-strip__remove"
                aria-label={`Remove proof ${index + 1}`}
                onClick={() => removePending(index)}
              >
                <X size={14} weight="bold" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      {viewerUrl ? (
        <div
          className="proof-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Proof preview"
          onClick={() => setViewerUrl(null)}
        >
          <button
            type="button"
            className="proof-viewer__close"
            aria-label="Close"
            onClick={() => setViewerUrl(null)}
          >
            <X size={22} weight="bold" aria-hidden />
          </button>
          <img
            src={viewerUrl}
            alt="Ledger entry proof"
            className="proof-viewer__img"
            onClick={(e) => e.stopPropagation()}
          />
          {viewerItem ? (
            <Button
              type="button"
              variant="danger-ghost"
              className="proof-viewer__delete"
              onClick={(e) => {
                e.stopPropagation()
                void onDeleteSaved(viewerItem.attachment.id)
              }}
            >
              <Trash size={18} weight="bold" aria-hidden />
              Delete proof
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
