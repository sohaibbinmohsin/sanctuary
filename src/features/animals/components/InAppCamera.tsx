import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, X } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/Button'

type InAppCameraProps = {
  onCapture: (blob: Blob) => void
  onCancel: () => void
}

/**
 * Full-screen `getUserMedia` camera used for the verified in-app photo
 * capture path. Never falls back to a file picker — offline/gallery paths
 * are handled by the caller before this mounts.
 */
export function InAppCamera({ onCapture, onCancel }: InAppCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch {
        if (!cancelled) {
          setError('Could not access the camera. Check permissions and try again.')
        }
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onCancel])

  function handleCapture() {
    const video = videoRef.current
    if (!video || !ready || capturing) return
    setCapturing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 960
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('Could not capture photo. Try again.')
        setCapturing(false)
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          setCapturing(false)
          if (blob) {
            onCapture(blob)
          } else {
            setError('Could not capture photo. Try again.')
          }
        },
        'image/jpeg',
        0.85,
      )
    } catch {
      setCapturing(false)
      setError('Could not capture photo. Try again.')
    }
  }

  return createPortal(
    <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Camera">
      <button
        type="button"
        className="camera-overlay__close"
        aria-label="Close camera"
        onClick={onCancel}
      >
        <X size={22} weight="bold" aria-hidden />
      </button>
      {error ? (
        <div className="camera-overlay__error">
          <p>{error}</p>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className="camera-overlay__video"
            autoPlay
            playsInline
            muted
          />
          <div className="camera-overlay__controls">
            <button
              type="button"
              className="camera-overlay__shutter"
              aria-label="Take photo"
              disabled={!ready || capturing}
              onClick={handleCapture}
            >
              <Camera size={26} weight="bold" aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
