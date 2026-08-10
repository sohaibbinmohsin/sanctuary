import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Camera, ImageSquare, Plus } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { useDb } from '@/shared/hooks/useDb'
import { useCanTakePhoto } from '@/shared/hooks/useCanTakePhoto'
import {
  countPendingPhotos,
  processPhotoQueue,
  queuePhoto,
} from '@/features/photos/domain/photos'
import { isPlaygroundMode } from '@/features/playground/mode'

type PhotoCaptureProps = {
  orgId: string
  animalId: string
  onQueued?: () => void
  onError?: (message: string) => void
}

type MenuPos = { top: number; left: number }

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
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)

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
    const id = window.setInterval(tick, 30_000)
    window.addEventListener('online', tick)
    return () => {
      window.clearInterval(id)
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

  async function onFiles(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length || !db) return
    setBusy(true)
    setMenuOpen(false)
    try {
      for (const file of Array.from(files)) {
        await queuePhoto(db, { orgId, animalId, blob: file })
      }
      await refreshPending()
      onQueued?.()
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Could not save photo. Try again.',
      )
    } finally {
      setBusy(false)
      if (input) input.value = ''
    }
  }

  function onPlusClick() {
    if (busy) return
    if (canTakePhoto) {
      setMenuOpen((open) => !open)
      return
    }
    galleryRef.current?.click()
  }

  return (
    <>
      <div className="photo-strip__add-wrap" role="listitem">
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
        <button
          ref={buttonRef}
          type="button"
          className="photo-strip__thumb photo-strip__add"
          disabled={busy}
          aria-label={
            busy
              ? 'Saving photo'
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
            <span className="photo-strip__badge" aria-hidden>
              {pending}
            </span>
          ) : null}
        </button>
      </div>
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
                disabled={busy}
                onClick={() => {
                  setMenuOpen(false)
                  cameraRef.current?.click()
                }}
              >
                <Camera size={16} weight="bold" aria-hidden />
                Take photo
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
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
    </>
  )
}
