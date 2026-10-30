import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Camera, ImageSquare, Plus, X } from '@phosphor-icons/react'
import { supportsCameraCapture } from '@/shared/hooks/useCanTakePhoto'
import { InAppCamera } from '@/features/animals/components/InAppCamera'

export type StagedPhoto = {
  id: string
  blob: Blob
  previewUrl: string
  captureSource: 'camera' | 'gallery'
}

type IntakePhotoPickerProps = {
  photos: StagedPhoto[]
  onAddPhotos: (newPhotos: StagedPhoto[]) => void
  onRemovePhoto: (id: string) => void
  disabled?: boolean
}

type MenuPos = { top: number; left: number }

export function IntakePhotoPicker({
  photos,
  onAddPhotos,
  onRemovePhoto,
  disabled = false,
}: IntakePhotoPickerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const [showCamera, setShowCamera] = useState(false)

  useLayoutEffect(() => {
    if (!menuOpen || !buttonRef.current) {
      setMenuPos(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    const menuHeight = 96
    const menuWidth = 160
    let top = rect.bottom + 6
    if (rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight) {
      top = rect.top - menuHeight
    } else if (top + menuHeight > window.innerHeight) {
      top = Math.max(8, window.innerHeight - menuHeight - 8)
    }
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))
    setMenuPos({ top, left })
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
    if (disabled || showCamera) return
    setMenuOpen((open) => !open)
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return
    setMenuOpen(false)
    const newPhotos: StagedPhoto[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      blob: file,
      previewUrl: URL.createObjectURL(file),
      captureSource: 'gallery',
    }))
    onAddPhotos(newPhotos)
    if (galleryRef.current) galleryRef.current.value = ''
  }

  function onCameraCapture(blob: Blob) {
    setShowCamera(false)
    const photo: StagedPhoto = {
      id: crypto.randomUUID(),
      blob,
      previewUrl: URL.createObjectURL(blob),
      captureSource: 'camera',
    }
    onAddPhotos([photo])
  }

  return (
    <>
      <div className="photo-strip" role="list" aria-label="Photos">
        <div className="photo-strip__add-wrap" role="listitem">
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          <button
            ref={buttonRef}
            type="button"
            className="photo-strip__thumb photo-strip__add"
            disabled={disabled || showCamera}
            aria-label={
              showCamera
                ? 'Camera in use'
                : photos.length > 0
                  ? `Add photo, ${photos.length} attached`
                  : 'Add photo'
            }
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="Add photo"
            onClick={onPlusClick}
          >
            <Plus size={22} weight="bold" aria-hidden />
            {photos.length > 0 ? (
              <span className="photo-strip__badge" title={`${photos.length} attached`}>
                {photos.length}
              </span>
            ) : null}
          </button>
        </div>

        {photos.map((item) => (
          <div key={item.id} className="photo-strip__thumb-wrap" role="listitem">
            <div
              className="photo-strip__thumb"
              style={{ backgroundImage: `url(${item.previewUrl})` }}
              aria-label="Photo preview"
            />
            <button
              type="button"
              className="photo-strip__thumb-remove"
              onClick={() => onRemovePhoto(item.id)}
              aria-label="Remove photo"
              title="Remove photo"
            >
              <X size={12} weight="bold" aria-hidden />
            </button>
          </div>
        ))}
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
                onClick={() => {
                  setMenuOpen(false)
                  if (supportsCameraCapture()) {
                    cameraInputRef.current?.click()
                  } else {
                    setShowCamera(true)
                  }
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

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const photo: StagedPhoto = {
              id: crypto.randomUUID(),
              blob: file,
              previewUrl: URL.createObjectURL(file),
              captureSource: 'camera',
            }
            onAddPhotos([photo])
          }
          e.target.value = ''
        }}
      />

      {showCamera ? (
        <InAppCamera
          onCapture={onCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
      ) : null}
    </>
  )
}
