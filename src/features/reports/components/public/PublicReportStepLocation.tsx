import { useState, type FormEvent, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, Crosshair, Check, Camera, Trash } from '@phosphor-icons/react'
import { PAKISTAN_CITIES, getAreasForCity } from '@/features/reports/domain/pakistanLocations'
import { requestCurrentPosition } from '@/features/reports/domain/coordinates'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'

export type PublicPhotoItem = {
  id: string
  url: string
  blob: Blob
}

export type PublicReportStepLocationProps = {
  draft: ReportDraftState
  photos: PublicPhotoItem[]
  onUpdate: (patch: Partial<ReportDraftState>) => void
  onAddPhotos: (newPhotos: PublicPhotoItem[]) => void
  onRemovePhoto: (id: string) => void
  onBack: () => void
  onNext: () => void
}

export function PublicReportStepLocation({
  draft,
  photos,
  onUpdate,
  onAddPhotos,
  onRemovePhoto,
  onBack,
  onNext,
}: PublicReportStepLocationProps) {
  const [detectingGps, setDetectingGps] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const cityAreas = getAreasForCity(draft.city)

  async function handleGetLocation() {
    setDetectingGps(true)
    setGpsError(null)
    try {
      const pos = await requestCurrentPosition()
      onUpdate({ latitude: pos.latitude, longitude: pos.longitude })
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Could not detect GPS location.')
    } finally {
      setDetectingGps(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const items: PublicPhotoItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      items.push({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        blob: file,
      })
    }
    onAddPhotos(items)
    e.target.value = ''
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.locationArea.trim()) return
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="public-report__step-form">
      <div className="public-report__field">
        <label htmlFor="report-city" className="public-report__label">
          City
        </label>
        <select
          id="report-city"
          className="public-report__select"
          value={draft.city}
          onChange={(e) => onUpdate({ city: e.target.value })}
        >
          {PAKISTAN_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="public-report__field">
        <label htmlFor="report-area" className="public-report__label">
          Area or Neighborhood
        </label>
        <input
          id="report-area"
          type="text"
          list="area-suggestions"
          className="public-report__input"
          placeholder="e.g. Gulberg III, DHA Phase 5, Saddar"
          value={draft.locationArea}
          onChange={(e) => onUpdate({ locationArea: e.target.value })}
          required
        />
        <datalist id="area-suggestions">
          {cityAreas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      <div className="public-report__field">
        <label htmlFor="report-landmark" className="public-report__label">
          Specific landmark or street (optional)
        </label>
        <input
          id="report-landmark"
          type="text"
          className="public-report__input"
          placeholder="e.g. Near Kalma Chowk underpass, opposite bakery"
          value={draft.locationLandmark}
          onChange={(e) => onUpdate({ locationLandmark: e.target.value })}
        />
      </div>

      <div className="public-report__gps-box">
        <div className="public-report__gps-info">
          <span className="public-report__label">Precise GPS coordinates</span>
          <p className="public-report__hint">
            Helps field rescue teams navigate directly to the animal in rural or unmapped areas.
          </p>
          {draft.latitude && draft.longitude ? (
            <span className="public-report__gps-badge">
              <Check size={14} weight="bold" aria-hidden /> GPS captured ({draft.latitude.toFixed(4)}, {draft.longitude.toFixed(4)})
            </span>
          ) : null}
          {gpsError ? <span className="public-report__error">{gpsError}</span> : null}
        </div>
        <button
          type="button"
          className="public-report__btn public-report__btn--secondary"
          onClick={handleGetLocation}
          disabled={detectingGps}
        >
          <Crosshair size={18} weight="bold" aria-hidden />
          {detectingGps ? 'Detecting...' : 'Share exact GPS location'}
        </button>
      </div>

      <div className="public-report__field">
        <label className="public-report__label">Photos of the animal or scene (optional)</label>
        <div className="public-report__photo-grid">
          {photos.map((item) => (
            <div key={item.id} className="public-report__photo-thumb">
              <img src={item.url} alt="Staged rescue photo" />
              <button
                type="button"
                className="public-report__photo-remove"
                onClick={() => onRemovePhoto(item.id)}
                aria-label="Remove photo"
              >
                <Trash size={16} weight="bold" />
              </button>
            </div>
          ))}
          {photos.length < 5 ? (
            <label className="public-report__photo-upload">
              <Camera size={26} weight="duotone" aria-hidden />
              <span>Add photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="public-report__file-hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="public-report__actions public-report__actions--split">
        <button type="button" className="public-report__btn public-report__btn--secondary" onClick={onBack}>
          <ArrowLeft size={18} weight="bold" aria-hidden />
          Back
        </button>
        <button
          type="submit"
          className="public-report__btn public-report__btn--primary"
          disabled={!draft.locationArea.trim()}
        >
          Continue to Contact
          <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </form>
  )
}
