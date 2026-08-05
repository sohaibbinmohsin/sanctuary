import { useEffect, useRef, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import {
  countPendingPhotos,
  processPhotoQueue,
  queuePhoto,
} from '@/features/photos/domain/photos'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshPending() {
    if (!db) return
    setPending(await countPendingPhotos(db, orgId))
  }

  useEffect(() => {
    void refreshPending()
  }, [db, orgId])

  useEffect(() => {
    if (!db) return
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
  }, [db, orgId])

  async function onFiles(files: FileList | null) {
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
      setError(err instanceof Error ? err.message : 'Could not queue photo')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="stack">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Saving…' : 'Add photo'}
        </button>
        {pending > 0 ? (
          <span className="muted">{pending} photos waiting</span>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}
