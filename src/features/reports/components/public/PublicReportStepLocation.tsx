import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Check,
  Camera,
  ImageSquare,
  Trash,
  NavigationArrow,
  PencilSimpleLine,
} from '@phosphor-icons/react'
import { PAKISTAN_CITIES, getAreasForCity } from '@/features/reports/domain/pakistanLocations'
import { requestCurrentPosition } from '@/features/reports/domain/coordinates'
import { extractPhotoMetadata } from '@/features/reports/domain/exif'
import { classifyReportPhoto } from '@/features/reports/domain/visionClassifier'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'
import {
  type ReportLanguage,
  type ReportTranslations,
  getReportTranslations,
} from '@/features/reports/domain/reportTranslations'

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
  onBack?: () => void
  onNext: () => void
  lang?: ReportLanguage
  t?: ReportTranslations
}

export function PublicReportStepLocation({
  draft,
  photos,
  onUpdate,
  onAddPhotos,
  onRemovePhoto,
  onBack,
  onNext,
  lang = 'en',
  t = getReportTranslations(lang),
}: PublicReportStepLocationProps) {
  const isUrdu = lang === 'ur'
  const [detectingGps, setDetectingGps] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [fromExif, setFromExif] = useState(false)
  const [locationMode, setLocationMode] = useState<'auto' | 'manual' | 'unselected'>(() => {
    if (draft.locationArea.trim() && draft.locationArea !== 'Current location') return 'manual'
    if (draft.latitude != null && draft.longitude != null && draft.locationArea === 'Current location') return 'auto'
    return 'unselected'
  })

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const sortedCities = [...PAKISTAN_CITIES].sort((a, b) => a.localeCompare(b))
  const cityAreas = getAreasForCity(draft.city)

  const CATEGORY_ITEMS = [
    { key: 'sick_injured', label: t.categorySickInjured },
    { key: 'cruelty', label: t.categoryCruelty },
  ] as const

  async function handleUseCurrentLocation() {
    setDetectingGps(true)
    setGpsError(null)
    setFromExif(false)
    try {
      const pos = await requestCurrentPosition()
      setLocationMode('auto')
      onUpdate({
        latitude: pos.latitude,
        longitude: pos.longitude,
        locationArea: draft.locationArea.trim() || 'Current location',
      })
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Could not detect current location.')
    } finally {
      setDetectingGps(false)
    }
  }

  function handleEnterManually() {
    setLocationMode('manual')
    if (draft.locationArea === 'Current location') {
      onUpdate({ locationArea: '' })
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
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

    // Attempt EXIF GPS extraction from the uploaded photos
    for (let i = 0; i < files.length; i++) {
      try {
        const meta = await extractPhotoMetadata(files[i]!)
        if (meta && meta.latitude != null && meta.longitude != null) {
          setFromExif(true)
          onUpdate({
            latitude: meta.latitude,
            longitude: meta.longitude,
          })
          break
        }
      } catch {
        // Fall back gracefully if photo has no EXIF
      }
    }

    // Trigger non-blocking AI vision analysis in the background
    if (files.length > 0) {
      const primaryFile = files[0]!
      Promise.resolve(classifyReportPhoto(primaryFile))
        .then((analysis) => {
          if (!analysis || !analysis.is_animal_present) return

          const patch: Partial<ReportDraftState> = {
            aiAnalysis: analysis,
          }

          if (analysis.animal_count && analysis.animal_count > 0) {
            patch.animalCount = analysis.animal_count
          }

          if (analysis.species_details) {
            patch.groupBreakdown = analysis.species_details
          }

          const primary = (analysis.species_primary || '').toLowerCase()
          if (primary.includes('dog')) {
            patch.speciesPreset = 'Dog'
          } else if (primary.includes('cat')) {
            patch.speciesPreset = 'Cat'
          } else if (primary.includes('bird')) {
            patch.speciesPreset = 'Bird'
          } else if (primary.includes('donkey')) {
            patch.speciesPreset = 'Donkey'
          } else if (primary.includes('horse')) {
            patch.speciesPreset = 'Horse'
          } else if (primary.includes('cow') || primary.includes('cattle')) {
            patch.speciesPreset = 'Cow'
          } else if (primary.includes('goat')) {
            patch.speciesPreset = 'Goat'
          } else if (analysis.species_primary && analysis.species_primary !== 'Unknown') {
            patch.speciesPreset = 'Other'
            patch.speciesOther = analysis.species_primary
          }

          if (analysis.composition === 'litter_only') {
            patch.intakeCountMode = 'litter'
            patch.litterComposition = 'offspring_only'
            patch.lifeStage = 'child'
          } else if (analysis.composition === 'mother_and_offspring') {
            patch.intakeCountMode = 'litter'
            patch.litterComposition = 'mother_and_offspring'
            patch.lifeStage = 'child'
          } else if (analysis.composition === 'group_pack') {
            patch.intakeCountMode = 'multiple'
            patch.lifeStage = 'adult'
          } else if (analysis.composition === 'single_juvenile') {
            patch.intakeCountMode = 'single'
            patch.lifeStage = 'child'
          } else if (analysis.composition === 'single_adult') {
            patch.intakeCountMode = 'single'
            patch.lifeStage = 'adult'
          }

          if (!draft.chiefComplaint.trim() && analysis.condition_and_injuries) {
            patch.chiefComplaint = analysis.condition_and_injuries
          }

          onUpdate(patch)
        })
        .catch(() => {
          // Silent background fallback
        })
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (photos.length === 0) return
    const hasCoords = draft.latitude != null && draft.longitude != null
    const hasArea = draft.locationArea.trim().length > 0
    if (!hasCoords && !hasArea) return

    if (!hasArea && hasCoords) {
      onUpdate({ locationArea: 'Current location' })
    }
    onNext()
  }

  const hasCoords = draft.latitude != null && draft.longitude != null
  const canContinue = photos.length > 0 && (hasCoords || draft.locationArea.trim().length > 0)

  return (
    <form onSubmit={handleSubmit} className="public-report__step-form">
      <div className="public-report__group">
        <label className="public-report__label">{t.reportCategoryLabel}</label>
        <div className="public-report__chips" role="group" aria-label="Report category">
          {CATEGORY_ITEMS.map((cat) => {
            const isSelected = draft.category === cat.key || (cat.key === 'sick_injured' && draft.category === 'emergency')
            return (
              <button
                key={cat.key}
                type="button"
                className={`public-report__chip ${isSelected ? 'public-report__chip--active' : ''}`}
                onClick={() => onUpdate({ category: cat.key })}
                aria-pressed={isSelected}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Photos Section */}
      <div className="public-report__field">
        <label className="public-report__label">{t.photosHeading}</label>
        <p className="public-report__hint">
          At least 1 photo is required so rescue teams can assess the animal and severity.
        </p>
        {photos.length > 0 ? (
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
          </div>
        ) : null}

        {photos.length < 5 ? (
          <div className="public-report__photo-actions">
            <button
              type="button"
              className="public-report__photo-action-btn"
              onClick={() => cameraInputRef.current?.click()}
              aria-label="Take photo with camera"
            >
              <Camera size={18} weight="bold" aria-hidden />
              <span>{t.takePhoto}</span>
            </button>
            <button
              type="button"
              className="public-report__photo-action-btn"
              onClick={() => galleryInputRef.current?.click()}
              aria-label="Add photo from gallery"
            >
              <ImageSquare size={18} weight="bold" aria-hidden />
              <span>{t.uploadPhoto}</span>
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="public-report__file-hidden"
              onChange={handleFileChange}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="public-report__file-hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : null}

        {photos.length === 0 ? (
          <span className="public-report__error" style={{ fontSize: 'var(--text-xs)' }}>
            Please attach at least 1 photo to continue.
          </span>
        ) : (
          <span className="public-report__valid-hint" style={{ fontSize: 'var(--text-xs)' }}>
            <Check size={14} weight="bold" aria-hidden /> {photos.length} {photos.length === 1 ? 'photo' : 'photos'} attached
          </span>
        )}
      </div>

      <div className="public-report__group">
        <label className="public-report__label">{t.locationChooseHeading}</label>

        {hasCoords && locationMode === 'auto' ? (
          <div className="public-report__loc-confirmed-card">
            <div className="public-report__loc-confirmed-info">
              <span className="public-report__loc-confirmed-title">
                <Check size={16} weight="bold" aria-hidden /> {fromExif ? t.gpsExtractedFromPhoto : t.locationConfirmed}
              </span>
              <span className="public-report__loc-confirmed-coords">
                {draft.latitude?.toFixed(4)}° N, {draft.longitude?.toFixed(4)}° E
              </span>
            </div>
            <button
              type="button"
              className="public-report__loc-change-btn"
              onClick={handleEnterManually}
            >
              {t.changeLocation}
            </button>
          </div>
        ) : null}

        {locationMode !== 'manual' && (!hasCoords || locationMode === 'unselected') ? (
          <div className="public-report__loc-choice-grid">
            <button
              type="button"
              className="public-report__loc-choice-btn"
              onClick={handleUseCurrentLocation}
              disabled={detectingGps}
            >
              <span className="public-report__loc-choice-title">
                <NavigationArrow size={18} weight="bold" aria-hidden />
                <span>{detectingGps ? 'Detecting location...' : t.useCurrentLocationBtn}</span>
              </span>
              <span className="public-report__loc-choice-sub">{t.useCurrentLocationSubtext}</span>
            </button>

            <button
              type="button"
              className="public-report__loc-choice-btn"
              onClick={handleEnterManually}
            >
              <span className="public-report__loc-choice-title">
                <PencilSimpleLine size={18} weight="bold" aria-hidden />
                <span>{t.enterLocationManuallyBtn}</span>
              </span>
              <span className="public-report__loc-choice-sub">{t.enterLocationManuallySubtext}</span>
            </button>
          </div>
        ) : null}

        {gpsError ? <span className="public-report__error">{gpsError}</span> : null}

        {locationMode === 'manual' ? (
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <div className="public-report__field">
              <label htmlFor="report-city" className="public-report__label">
                {t.cityLabel}
              </label>
              <select
                id="report-city"
                className="public-report__select"
                value={draft.city}
                onChange={(e) => onUpdate({ city: e.target.value })}
              >
                {sortedCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="public-report__field">
              <label htmlFor="report-area" className="public-report__label">
                {t.areaLabel}
              </label>
              <input
                id="report-area"
                type="text"
                list="area-suggestions"
                className="public-report__input"
                placeholder={t.areaPlaceholder}
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
                {t.landmarkLabel}
              </label>
              <input
                id="report-landmark"
                type="text"
                className="public-report__input"
                placeholder={t.landmarkPlaceholder}
                value={draft.locationLandmark}
                onChange={(e) => onUpdate({ locationLandmark: e.target.value })}
              />
            </div>

            <div style={{ marginTop: 'var(--space-1)' }}>
              <button
                type="button"
                className="public-report__loc-change-btn"
                onClick={handleUseCurrentLocation}
                disabled={detectingGps}
              >
                <Crosshair size={14} weight="bold" aria-hidden style={{ display: 'inline', verticalAlign: '-1px' }} />{' '}
                {detectingGps ? 'Detecting location...' : t.useCurrentLocationBtn}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="public-report__field">
        <label htmlFor="situation-notes" className="public-report__label">
          {t.situationNoteOptional}
        </label>
        <textarea
          id="situation-notes"
          className="public-report__textarea"
          placeholder={t.situationNotePlaceholder}
          value={draft.chiefComplaint}
          onChange={(e) => onUpdate({ chiefComplaint: e.target.value })}
          rows={2}
        />
      </div>

      <div className={`public-report__actions ${onBack ? 'public-report__actions--split' : ''}`}>
        {onBack ? (
          <button type="button" className="public-report__btn public-report__btn--secondary" onClick={onBack}>
            {isUrdu ? (
              <ArrowRight size={18} weight="bold" aria-hidden />
            ) : (
              <ArrowLeft size={18} weight="bold" aria-hidden />
            )}
            <span>{t.back}</span>
          </button>
        ) : null}
        <button
          type="submit"
          className="public-report__btn public-report__btn--primary"
          disabled={!canContinue}
        >
          <span>{t.nextContact}</span>
          {isUrdu ? (
            <ArrowLeft size={18} weight="bold" aria-hidden />
          ) : (
            <ArrowRight size={18} weight="bold" aria-hidden />
          )}
        </button>
      </div>
    </form>
  )
}
