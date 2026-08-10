import { useEffect, useRef, useState } from 'react'
import { Camera, ImageSquare } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCanTakePhoto } from '@/shared/hooks/useCanTakePhoto'
import {
  countPendingPhotos,
  processPhotoQueue,
  queuePhoto,
} from '@/features/photos/domain/photos'
import { Button } from '@/shared/ui/Button'
import { isPlaygroundMode } from '@/features/playground/mode'

type PhotoCaptureProps = {
  orgId: string
  animalId: string
  onQueued?: () => void
}

export function PhotoCapture({
  orgId,
  animalId,
  onQueued,
}: PhotoCaptureProps) {
  const db = useDb()
  const canTakePhoto = useCanTakePhoto()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function onFiles(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length || !db) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await queuePhoto(db, { orgId, animalId, blob: file })
      }
      await refreshPending()
      onQueued?.()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save photo. Try again.',
      )
    } finally {
      setBusy(false)
      if (input) input.value = ''
    }
  }

  return (
    <div className="stack">
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
        {pending > 0 ? (
          <span className="muted">
            {pending} photo{pending === 1 ? '' : 's'} waiting to upload
          </span>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}
