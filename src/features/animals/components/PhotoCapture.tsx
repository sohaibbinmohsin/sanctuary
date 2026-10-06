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
import { InAppCamera } from '@/features/animals/components/InAppCamera'
import { Button } from '@/shared/ui/Button'

type PhotoCaptureProps = {
  orgId: string
  animalId: string
  onQueued?: () => void
  onError?: (message: string) => void
}

type MenuPos = { top: number; left: number }

/**
 * Verified-camera flow state. `captureToken` is only ever set on the
 * `active` stage after a successful online session mint — offline and
 * gallery captures always go through with no token (never verified, and
 * never upgraded later).
 */
type CameraStage =
  | { kind: 'idle' }
  | { kind: 'minting' }
  | { kind: 'offline-warn' }
  | { kind: 'retry-warn' }
  | { kind: 'active'; captureToken: string | null }

export function PhotoCapture({
  orgId,
  animalId,
  onQueued,
  onError,
}: PhotoCaptureProps) {
  const db = useDb()
  const canTakePhoto = useCanTakePhoto()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const [cameraStage, setCameraStage] = useState<CameraStage>({ kind: 'idle' })
  const cameraFlowActive = cameraStage.kind !== 'idle'

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

  async function mintSessionAndOpenCamera() {
    setCameraStage({ kind: 'minting' })
    try {
      const session = await requestCaptureSession({ animalId })
      setCameraStage({ kind: 'active', captureToken: session.token })
    } catch {
      setCameraStage({ kind: 'retry-warn' })
    }
  }

  function onTakePhotoClick() {
    if (cameraFlowActive) return
    setMenuOpen(false)
    // Playground has no auth to mint a session with — open the camera straight
    // away instead of failing into the "not verified" warning.
    if (isPlaygroundMode()) {
      setCameraStage({ kind: 'active', captureToken: null })
      return
    }
    if (!navigator.onLine) {
      setCameraStage({ kind: 'offline-warn' })
      return
    }
    void mintSessionAndOpenCamera()
  }

  function onPlusClick() {
    if (cameraFlowActive) return
    if (canTakePhoto) {
      setMenuOpen((open) => !open)
      return
    }
    galleryRef.current?.click()
  }

  function onCameraCapture(blob: Blob) {
    const stage = cameraStage
    setCameraStage({ kind: 'idle' })
    void saveCameraPhoto(
      blob,
      stage.kind === 'active' ? (stage.captureToken ?? undefined) : undefined,
    )
  }

  function onCameraCancel() {
    setCameraStage({ kind: 'idle' })
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
          aria-expanded={canTakePhoto ? menuOpen : undefined}
          aria-haspopup={canTakePhoto ? 'menu' : undefined}
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
      {cameraStage.kind === 'active' ? (
        <InAppCamera onCapture={onCameraCapture} onCancel={onCameraCancel} />
      ) : null}
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
                onClick={() => setCameraStage({ kind: 'active', captureToken: null })}
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
                onClick={() => void mintSessionAndOpenCamera()}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="secondary"
                block
                onClick={() => setCameraStage({ kind: 'active', captureToken: null })}
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
