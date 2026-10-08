import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Camera,
  CircleNotch,
  ImageSquare,
  Plus,
  SealCheck,
  WarningCircle,
} from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { useDb } from '@/shared/hooks/useDb'
import { useCanTakePhoto } from '@/shared/hooks/useCanTakePhoto'
import {
  countPendingPhotos,
  processPhotoQueue,
  queuePhoto,
} from '@/features/photos/domain/photos'
import { requestCaptureSession } from '@/shared/lib/r2/captureSession'
import { isPlaygroundMode } from '@/features/playground/mode'
import { Button } from '@/shared/ui/Button'

type PhotoCaptureProps = {
  orgId: string
  animalId: string
  shelterCode?: string | null
  animalName?: string | null
  onQueued?: () => void
  onError?: (message: string) => void
}

type MenuPos = { top: number; left: number }

/**
 * Verified-camera flow state. `pendingSessionToken` is set after a successful
 * online session mint — offline and gallery captures always go through with no
 * token (never verified, and never upgraded later).
 */
type CameraStage =
  | { kind: 'idle' }
  | { kind: 'minting' }
  | { kind: 'offline-warn' }
  | { kind: 'retry-warn' }

type ReviewPhoto = {
  blob: Blob
  previewUrl: string
  captureToken: string | null
}

export function PhotoCapture({
  orgId,
  animalId,
  shelterCode,
  animalName,
  onQueued,
  onError,
}: PhotoCaptureProps) {
  const db = useDb()
  const canTakePhoto = useCanTakePhoto()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const [cameraStage, setCameraStage] = useState<CameraStage>({ kind: 'idle' })
  const [pendingSessionToken, setPendingSessionToken] = useState<string | null>(null)
  const [reviewPhoto, setReviewPhoto] = useState<ReviewPhoto | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const cameraFlowActive =
    cameraStage.kind !== 'idle' || Boolean(reviewPhoto) || isSaving

  async function refreshPending() {
    if (!db) return
    setPending(await countPendingPhotos(db, orgId, animalId))
  }

  useEffect(() => {
    void refreshPending()
  }, [db, orgId, animalId])

  useEffect(() => {
    if (!db || isPlaygroundMode()) return
    const tick = () => {
      if (navigator.onLine) {
        void processPhotoQueue(db).then(() => refreshPending())
      }
    }
    tick()
    window.addEventListener('online', tick)
    return () => {
      window.removeEventListener('online', tick)
    }
  }, [db, orgId, animalId])

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

  useEffect(() => {
    return () => {
      if (reviewPhoto?.previewUrl) {
        URL.revokeObjectURL(reviewPhoto.previewUrl)
      }
    }
  }, [reviewPhoto?.previewUrl])

  useEffect(() => {
    if (!reviewPhoto) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) {
        onCancelReview()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [reviewPhoto, isSaving])

  async function saveCameraPhoto(blob: Blob, captureToken?: string) {
    if (!db) return
    try {
      await queuePhoto(db, {
        orgId,
        animalId,
        blob,
        captureSource: 'camera',
        captureToken,
      })
      await refreshPending()
      onQueued?.()
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Could not save photo. Try again.',
      )
      return
    }
    // Upload / verify in the background so staff can keep capturing.
    if (navigator.onLine && !isPlaygroundMode()) {
      void processPhotoQueue(db)
        .then(() => refreshPending())
        .then(() => onQueued?.())
    }
  }

  async function onFiles(
    files: FileList | null,
    input: HTMLInputElement | null,
  ) {
    if (!files?.length || !db) return
    setMenuOpen(false)
    try {
      for (const file of Array.from(files)) {
        await queuePhoto(db, {
          orgId,
          animalId,
          blob: file,
          captureSource: 'gallery',
        })
      }
      await refreshPending()
      onQueued?.()
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Could not save photo. Try again.',
      )
      if (input) input.value = ''
      return
    }
    if (input) input.value = ''
    if (navigator.onLine && !isPlaygroundMode()) {
      void processPhotoQueue(db)
        .then(() => refreshPending())
        .then(() => onQueued?.())
    }
  }

  async function mintSessionAndTriggerCamera() {
    setCameraStage({ kind: 'minting' })
    try {
      const session = await requestCaptureSession({ animalId })
      setPendingSessionToken(session.token)
      setCameraStage({ kind: 'idle' })
      cameraInputRef.current?.click()
    } catch {
      setCameraStage({ kind: 'retry-warn' })
    }
  }

  function onTakePhotoClick() {
    if (cameraFlowActive) return
    setMenuOpen(false)
    // Playground has no auth to mint a session with — open native camera directly
    if (isPlaygroundMode()) {
      setPendingSessionToken(null)
      setCameraStage({ kind: 'idle' })
      cameraInputRef.current?.click()
      return
    }
    if (!navigator.onLine) {
      setCameraStage({ kind: 'offline-warn' })
      return
    }
    void mintSessionAndTriggerCamera()
  }

  function onPlusClick() {
    if (cameraFlowActive) return
    if (canTakePhoto || isPlaygroundMode()) {
      setMenuOpen((open) => !open)
      return
    }
    galleryRef.current?.click()
  }

  function onCameraCaptureSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setReviewPhoto({
      blob: file,
      previewUrl,
      captureToken: pendingSessionToken,
    })
    e.target.value = ''
  }

  async function onConfirmSavePhoto() {
    if (!reviewPhoto || isSaving) return
    setIsSaving(true)
    try {
      await saveCameraPhoto(
        reviewPhoto.blob,
        reviewPhoto.captureToken ?? undefined,
      )
      URL.revokeObjectURL(reviewPhoto.previewUrl)
      setReviewPhoto(null)
      setPendingSessionToken(null)
    } finally {
      setIsSaving(false)
    }
  }

  function onRetakePhoto() {
    if (isSaving) return
    if (reviewPhoto) {
      URL.revokeObjectURL(reviewPhoto.previewUrl)
      setReviewPhoto(null)
    }
    // Re-trigger native camera while retaining pendingSessionToken
    cameraInputRef.current?.click()
  }

  function onCancelReview() {
    if (isSaving) return
    if (reviewPhoto) {
      URL.revokeObjectURL(reviewPhoto.previewUrl)
      setReviewPhoto(null)
    }
    setPendingSessionToken(null)
  }

  function onOfflineProceed() {
    setCameraStage({ kind: 'idle' })
    setPendingSessionToken(null)
    cameraInputRef.current?.click()
  }

  function onRetryWarnProceed() {
    setCameraStage({ kind: 'idle' })
    setPendingSessionToken(null)
    cameraInputRef.current?.click()
  }

  return (
    <>
      <div className="photo-strip__add-wrap" role="listitem">
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void onFiles(e.target.files, galleryRef.current)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onCameraCaptureSelected}
        />
        <button
          ref={buttonRef}
          type="button"
          className="photo-strip__thumb photo-strip__add"
          disabled={cameraFlowActive}
          aria-label={
            cameraFlowActive
              ? 'Camera in use'
              : pending > 0
                ? `Add photo, ${pending} waiting to upload`
                : 'Add photo'
          }
          aria-expanded={(canTakePhoto || isPlaygroundMode()) ? menuOpen : undefined}
          aria-haspopup={(canTakePhoto || isPlaygroundMode()) ? 'menu' : undefined}
          title={
            pending > 0
              ? `${pending} waiting to upload`
              : 'Add photo'
          }
          onClick={onPlusClick}
        >
          <Plus size={22} weight="bold" aria-hidden />
          {pending > 0 ? (
            <span className="photo-strip__badge" title={`${pending} waiting to upload`}>
              {pending}
            </span>
          ) : null}
        </button>
      </div>

      {cameraStage.kind === 'minting'
        ? createPortal(
            <div className="confirm-root" role="presentation">
              <div className="confirm-backdrop" aria-hidden />
              <div
                className="confirm-card"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="confirm-card__icon">
                  <CircleNotch
                    size={28}
                    weight="bold"
                    aria-hidden
                    className="photo-capture__spin"
                  />
                </div>
                <h2 className="confirm-card__title">Preparing camera…</h2>
                <p className="confirm-card__body">
                  Confirming a verified session. This can take a moment on a slow
                  connection.
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}

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
                onClick={onTakePhotoClick}
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

      {reviewPhoto
        ? createPortal(
            <div className="camera-confirm-dialog" role="dialog" aria-modal="true">
              <div className="camera-confirm-backdrop" onClick={onCancelReview} />
              <div className="camera-confirm-card camera-confirm-sheet">
                <h2 className="confirm-card__title">Photo captured</h2>

                {/* Image Card with Tag and ID on it */}
                <div className="confirm-image-card">
                  <div
                    className="confirm-image-card__img"
                    style={{ backgroundImage: `url(${reviewPhoto.previewUrl})` }}
                  />
                  <div className="confirm-image-card__overlay">
                    <span className="shelter-code">
                      {shelterCode || animalName || 'Animal photo'}
                    </span>
                    {reviewPhoto.captureToken ? (
                      <span className="confirm-image-card__badge verified-badge">
                        <SealCheck size={14} weight="fill" />
                        Verified photo
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="confirm-card__actions camera-confirm-actions">
                  <Button
                    type="button"
                    variant="primary"
                    block
                    onClick={() => void onConfirmSavePhoto()}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving photo…' : 'Save photo'}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    block
                    onClick={onRetakePhoto}
                    disabled={isSaving}
                  >
                    Retake photo
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    block
                    onClick={onCancelReview}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {cameraStage.kind === 'offline-warn'
        ? createPortal(
            <CameraWarningDialog
              title="This photo won't be verified on the public page."
              body="You're offline right now, so this photo can't be checked. It will still be saved and shown, just without the verified mark."
              onCancel={() => setCameraStage({ kind: 'idle' })}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCameraStage({ kind: 'idle' })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={onOfflineProceed}
              >
                Proceed
              </Button>
            </CameraWarningDialog>,
            document.body,
          )
        : null}

      {cameraStage.kind === 'retry-warn'
        ? createPortal(
            <CameraWarningDialog
              title="This photo won't be verified on the public page."
              body="We couldn't confirm a verified session for this photo. You can try again, take an unverified photo instead, or cancel."
              onCancel={() => setCameraStage({ kind: 'idle' })}
              stacked
            >
              <Button
                type="button"
                variant="primary"
                block
                onClick={() => void mintSessionAndTriggerCamera()}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="secondary"
                block
                onClick={onRetryWarnProceed}
              >
                Proceed unverified
              </Button>
              <Button
                type="button"
                variant="ghost"
                block
                onClick={() => setCameraStage({ kind: 'idle' })}
              >
                Cancel
              </Button>
            </CameraWarningDialog>,
            document.body,
          )
        : null}
    </>
  )
}

type CameraWarningDialogProps = {
  title: string
  body: string
  onCancel: () => void
  stacked?: boolean
  children: ReactNode
}

/** Matches the app's shared `.confirm-*` dialog styling (see `ConfirmDialog`). */
function CameraWarningDialog({
  title,
  body,
  onCancel,
  stacked,
  children,
}: CameraWarningDialogProps) {
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel])

  return (
    <div className="confirm-root" role="presentation">
      <button
        type="button"
        className="confirm-backdrop"
        aria-label="Dismiss"
        onClick={onCancel}
      />
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <div className="confirm-card__icon confirm-card__icon--danger">
          <WarningCircle size={28} weight="duotone" aria-hidden />
        </div>
        <h2 id={titleId} className="confirm-card__title">
          {title}
        </h2>
        <p id={bodyId} className="confirm-card__body">
          {body}
        </p>
        <div
          className={
            stacked ? 'confirm-card__actions confirm-card__actions--stack' : 'confirm-card__actions'
          }
        >
          {children}
        </div>
      </div>
    </div>
  )
}
