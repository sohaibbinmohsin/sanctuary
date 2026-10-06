import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { MedicalCrossIcon } from '@/shared/ui/MedicalCrossIcon'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import { isPlaygroundMode } from '@/features/playground/mode'
import { InAppCamera } from '@/features/animals/components/InAppCamera'

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

type MenuPos = { top: number; left: number }

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const [showCamera, setShowCamera] = useState(false)
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
    if (rows.length === 0) {
      setSavedItems((current) => (current.length === 0 ? current : []))
      return
    }
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
    window.addEventListener('online', tick)
    return () => {
      window.removeEventListener('online', tick)
    }
  }, [db, orgId, entryId])

  useLayoutEffect(() => {
    if (!menuOpen || !buttonRef.current) {
      setMenuPos(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
    })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    function onScroll() {
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [menuOpen])

  function onPlusClick() {
    if (busy || showCamera) return
    if (canTakePhoto) {
      setMenuOpen((open) => !open)
      return
    }
    galleryRef.current?.click()
  }

  function onCameraCapture(blob: Blob) {
    setShowCamera(false)
    const file = new File([blob], `proof-${Date.now()}.jpg`, { type: 'image/jpeg' })
    void onFiles([file], null)
  }

  async function onFiles(
    files: FileList | null | File[],
    input?: HTMLInputElement | null,
  ) {
    if (!files) return
    const fileList = Array.isArray(files) ? files : Array.from(files)
    if (fileList.length === 0) return
    const images = fileList.filter((f) => f.type.startsWith('image/'))
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
  const totalCount = savedItems.length + pendingFiles.length

  return (
    <div className="stack">
      <div className="field">
        <span>
          {label}
          <span className="field__hint"> · optional · receipt or photo</span>
        </span>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files, galleryRef.current)}
      />

      <div className="photo-strip" role="list" aria-label="Proof">
        <div className="photo-strip__add-wrap" role="listitem">
          <button
            ref={buttonRef}
            type="button"
            className="photo-strip__thumb photo-strip__add"
            disabled={busy || showCamera}
            aria-label={
              showCamera
                ? 'Camera in use'
                : totalCount > 0
                  ? `Add proof, ${totalCount} attached`
                  : 'Add proof'
            }
            aria-expanded={canTakePhoto ? menuOpen : undefined}
            aria-haspopup={canTakePhoto ? 'menu' : undefined}
            title="Add proof"
            onClick={onPlusClick}
          >
            <MedicalCrossIcon size={20} />
            {totalCount > 0 ? (
              <span className="photo-strip__badge" title={`${totalCount} attached`}>
                {totalCount}
              </span>
            ) : null}
          </button>
        </div>

        {savedItems.map(({ attachment, url }) => (
          <div className="photo-strip__thumb-wrap" role="listitem" key={attachment.id}>
            <button
              type="button"
              className="photo-strip__thumb"
              style={{ backgroundImage: `url(${url})` }}
              aria-label="View proof"
              onClick={() => setViewerUrl(url)}
            />
            {attachment.upload_state === 'pending' ||
            attachment.upload_state === 'failed' ||
            attachment.upload_state === 'uploading' ? (
              <span className="photo-strip__badge muted">
                {attachment.upload_state === 'failed' ? 'Retry' : '…'}
              </span>
            ) : null}
          </div>
        ))}

        {previewUrls.map((url, index) => (
          <div className="photo-strip__thumb-wrap" role="listitem" key={`pending-${index}`}>
            <button
              type="button"
              className="photo-strip__thumb"
              style={{ backgroundImage: `url(${url})` }}
              aria-label={`Proof ${index + 1}`}
              onClick={() => setViewerUrl(url)}
            />
            <button
              type="button"
              className="photo-strip__thumb-remove"
              aria-label={`Remove proof ${index + 1}`}
              onClick={() => removePending(index)}
              title="Remove proof"
            >
              <X size={12} weight="bold" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {pendingUpload > 0 ? (
        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          {pendingUpload} waiting to upload
        </span>
      ) : null}

      {menuOpen && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="photo-strip__menu"
              role="menu"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  setShowCamera(true)
                }}
              >
                <Camera size={16} weight="bold" aria-hidden />
                Take photo
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  galleryRef.current?.click()
                }}
              >
                <ImageSquare size={16} weight="bold" aria-hidden />
                From gallery
              </button>
            </div>,
            document.body,
          )
        : null}

      {showCamera ? (
        <InAppCamera
          onCapture={onCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
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
