import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, SealCheck, X } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  createQuickAnimalStub,
  getNextShelterCode,
} from '@/features/animals/domain/animals'
import { requestCaptureSession } from '@/shared/lib/r2/captureSession'
import {
  processPhotoQueue,
  rememberCaptureToken,
  listPhotosForAnimal,
} from '@/features/photos/domain/photos'
import { isPlaygroundMode } from '@/features/playground/mode'
import './FieldCameraIntakeScreen.css'

export function FieldCameraIntakeScreen() {
  const db = useDb()
  const navigate = useNavigate()
  const { member } = useCurrentMember()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const [streamReady, setStreamReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)
  const [predictedCode, setPredictedCode] = useState<string>('...')
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Initialize camera stream
  useEffect(() => {
    let cancelled = false

    async function initCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera not supported on this device')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStreamReady(true)
      } catch (err) {
        if (!cancelled) {
          setCameraError('Could not access camera. Please check camera permissions.')
        }
      }
    }

    void initCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  // Load next shelter code
  useEffect(() => {
    if (!db || !member) return
    void getNextShelterCode(db, member.orgId, member.orgInitials).then(setPredictedCode)
  }, [db, member])

  function handleCapture() {
    const video = videoRef.current
    if (!video || !streamReady || saving) return

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 960
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) return
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
          }
          const url = URL.createObjectURL(blob)
          previewUrlRef.current = url
          setCapturedBlob(blob)
          setCapturedPreview(url)
          setShowConfirm(true)
        },
        'image/jpeg',
        0.88,
      )
    } catch (e) {
      console.error('Failed to capture frame', e)
    }
  }

  function handleRetake() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setCapturedBlob(null)
    setCapturedPreview(null)
    setShowConfirm(false)
  }

  async function handleSave(mode: 'later' | 'now') {
    if (!db || !member || !capturedBlob || saving) return
    setSaving(true)

    try {
      // 1. Create animal stub
      const { animal, shelterCode } = await createQuickAnimalStub(db, {
        orgId: member.orgId,
        prefix: member.orgInitials,
        photoBlob: capturedBlob,
        captureSource: 'camera',
      })

      // 2. If online and not playground, mint verified session
      if (navigator.onLine && !isPlaygroundMode()) {
        try {
          const session = await requestCaptureSession({ animalId: animal.id })
          if (session?.token) {
            const photos = await listPhotosForAnimal(db, animal.id)
            if (photos[0]) {
              rememberCaptureToken(photos[0].id, session.token)
            }
          }
        } catch (err) {
          console.warn('Verified session mint error (saved as unverified camera capture):', err)
        }
        void processPhotoQueue(db)
      }

      if (mode === 'later') {
        // Show morale toast, refresh next code, and reset camera for next animal
        setToastMessage(`${shelterCode} saved · Ready for next animal`)
        handleRetake()
        void getNextShelterCode(db, member.orgId, member.orgInitials).then(setPredictedCode)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200)
      } else {
        // Navigate straight to edit details
        navigate(`/animals/${animal.id}/edit`)
      }
    } catch (err) {
      console.error('Failed to save quick animal stub', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="camera-intake-screen">
      {/* Viewfinder stream */}
      <div className="camera-overlay">
        {capturedPreview ? (
          <div
            className="camera-overlay__video"
            style={{
              backgroundImage: `url(${capturedPreview})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <video
            ref={videoRef}
            className="camera-overlay__video"
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Top Bar */}
        <div className="camera-overlay__top">
          <button
            type="button"
            className="camera-overlay__close"
            onClick={() => navigate('/animals')}
            aria-label="Close camera"
          >
            <X size={20} weight="bold" />
          </button>
          <button
            type="button"
            className="camera-overlay__skip"
            onClick={() => navigate('/animals/new')}
          >
            Skip to form
          </button>
        </div>

        {/* Center reticle */}
        <div className="camera-overlay__viewfinder" />

        {/* Shutter controls */}
        {!showConfirm && (
          <div className="camera-overlay__controls">
            <button
              type="button"
              className="camera-overlay__shutter"
              onClick={handleCapture}
              disabled={!streamReady || saving}
              aria-label="Take verified photo"
            >
              <div className="camera-overlay__shutter-inner" />
            </button>
          </div>
        )}

        {/* Camera error state */}
        {cameraError && (
          <div className="camera-overlay__error" role="alert">
            <p>{cameraError}</p>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate('/animals/new')}
            >
              Go to Intake Form
            </button>
          </div>
        )}
      </div>

      {/* Review Dialog matching approved prototype */}
      {showConfirm && (
        <div className="confirm-root is-active" role="dialog" aria-modal="true">
          <div className="confirm-backdrop" onClick={handleRetake} />
          <div className="confirm-card">
            <h2 className="confirm-card__title">Photo captured</h2>

            {/* Image Card with Tag and ID on it */}
            <div className="confirm-image-card">
              <div
                className="confirm-image-card__img"
                style={
                  capturedPreview
                    ? { backgroundImage: `url(${capturedPreview})` }
                    : undefined
                }
              />
              <div className="confirm-image-card__overlay">
                <span className="shelter-code">{predictedCode}</span>
                <span className="verified-badge">
                  <SealCheck size={14} weight="fill" />
                  Verified photo
                </span>
              </div>
            </div>

            <div className="confirm-card__actions">
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => handleSave('later')}
                disabled={saving}
              >
                {saving ? 'Saving stub…' : 'Add details later'}
              </button>

              <button
                type="button"
                className="btn btn--secondary btn--block"
                onClick={() => handleSave('now')}
                disabled={saving}
              >
                Add details now →
              </button>

              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={handleRetake}
                disabled={saving}
              >
                Retake photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Morale Toast */}
      {toastMessage && (
        <div className="morale-toast is-visible" role="status">
          <CheckCircle size={16} weight="fill" color="#6EE7B7" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
