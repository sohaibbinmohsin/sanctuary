import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, Camera, Crosshair, MapPin, Compass, CircleNotch } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { TextField, TextareaField } from '@/shared/ui/Field'
import { AutocompleteField } from '@/shared/ui/AutocompleteField'
import {
  IntakePhotoPicker,
  type StagedPhoto,
} from '@/features/animals/components/IntakePhotoPicker'
import {
  createRescueReport,
  updateRescueReport,
  getRescueReportById,
  generateReportNumber,
  addReportPhoto,
  getPhotosForReport,
  deleteReportPhoto,
  formatPhoneNumber,
  validatePhoneNumber,
  formatCnic,
  validateCnic,
  formatCoordinates,
  getNavigationUrl,
  requestCurrentPosition,
  parseCoordinates,
  PAKISTAN_CITIES,
  getAreasForCity,
  type ReportPhoto,
  type RescueReport,
} from '@/features/reports/domain/rescueReports'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'

const SPECIES_PRESETS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other'] as const

const CATEGORY_OPTIONS = [
  { value: 'emergency', label: 'Medical emergency' },
  { value: 'cruelty', label: 'Animal cruelty' },
] as const

export function ReportIntakeScreen() {
  const db = useDb()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const { member } = useCurrentMember()

  const [existingReport, setExistingReport] = useState<RescueReport | null>(null)
  const [existingPhotos, setExistingPhotos] = useState<ReportPhoto[]>([])
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<Record<string, string>>({})
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([])
  const [loadingInitial, setLoadingInitial] = useState(isEditMode)

  const [category, setCategory] = useState<string>('emergency')
  const [speciesPreset, setSpeciesPreset] = useState<string>('Dog')
  const [speciesOther, setSpeciesOther] = useState('')
  const [lifeStage, setLifeStage] = useState<'adult' | 'child'>('adult')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [city, setCity] = useState('Lahore')
  const [locationArea, setLocationArea] = useState('')
  const [locationLandmark, setLocationLandmark] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationLinkInput, setLocationLinkInput] = useState('')
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [reporterCnic, setReporterCnic] = useState('')
  const [legalNotes, setLegalNotes] = useState('')
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orgId = member?.orgId ?? existingReport?.org_id ?? ''
  const orgInitials = member?.orgInitials ?? 'SANCTUARY'

  useEffect(() => {
    if (!db || !id) return
    let cancelled = false
    async function loadData() {
      try {
        const report = await getRescueReportById(db, id!)
        if (cancelled || !report) return
        setExistingReport(report)
        setCategory(report.category || 'emergency')

        const speciesCap = report.species
          ? report.species.charAt(0).toUpperCase() + report.species.slice(1).toLowerCase()
          : 'Other'
        if ((SPECIES_PRESETS as readonly string[]).includes(speciesCap)) {
          setSpeciesPreset(speciesCap)
        } else {
          setSpeciesPreset('Other')
          setSpeciesOther(report.species || '')
        }
        setLifeStage((report.life_stage as 'adult' | 'child') || 'adult')
        setChiefComplaint(report.chief_complaint || '')
        setCity(report.city || 'Lahore')
        setLocationArea(report.location_area || '')
        setLocationLandmark(report.location_landmark || '')
        setLatitude(report.latitude ?? null)
        setLongitude(report.longitude ?? null)
        setReporterName(report.reporter_name || '')
        setReporterPhone(report.reporter_phone ? formatPhoneNumber(report.reporter_phone) : '')
        setReporterCnic(report.reporter_cnic ? formatCnic(report.reporter_cnic) : '')
        setLegalNotes(report.legal_notes || '')

        // Load existing photos
        const photos = await getPhotosForReport(db, id!)
        if (cancelled) return
        setExistingPhotos(photos)
        const urls: Record<string, string> = {}
        for (const p of photos) {
          const blob = await getLocalPhoto(p.id)
          if (blob) {
            urls[p.id] = URL.createObjectURL(blob)
          } else if (p.r2_key) {
            const pub = publicPhotoUrl(p.r2_key)
            if (pub) urls[p.id] = pub
          }
        }
        setExistingPhotoUrls(urls)
      } catch (err) {
        console.error('Failed to load report for editing', err)
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    }
    void loadData()
    return () => {
      cancelled = true
    }
  }, [db, id])

  const effectiveSpecies =
    speciesPreset === 'Other'
      ? speciesOther.trim() || 'Other'
      : speciesPreset

  const phoneValidation = validatePhoneNumber(reporterPhone)
  const cnicValidation = validateCnic(reporterCnic)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !orgId) {
      setError('Database or organization not ready.')
      return
    }

    const complaintTrimmed = chiefComplaint.trim()
    const cityTrimmed = city.trim() || 'Lahore'
    const areaTrimmed = locationArea.trim()

    if (!complaintTrimmed) {
      setError('Please provide a chief complaint or injury description.')
      return
    }

    if (!areaTrimmed) {
      setError('Please provide a location area.')
      return
    }

    if (reporterPhone.trim() && !phoneValidation.isValid) {
      setError(phoneValidation.error || 'Please enter a valid phone number (e.g. 0300-1234567).')
      return
    }

    if (reporterCnic.trim() && !cnicValidation.isValid) {
      setError(cnicValidation.error || 'Please enter a valid 13-digit CNIC (e.g. 42101-1234567-1).')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (isEditMode && id) {
        // Update details ONLY - preserve timeline milestones, stage, and disposition
        await updateRescueReport(db, id, {
          category,
          species: effectiveSpecies.toLowerCase(),
          lifeStage,
          chiefComplaint: complaintTrimmed,
          city: cityTrimmed,
          locationArea: areaTrimmed,
          locationLandmark: locationLandmark.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          reporterName: reporterName.trim() || null,
          reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
          reporterCnic: reporterCnic.trim() ? formatCnic(reporterCnic) : null,
          legalNotes: legalNotes.trim() || null,
        })

        // Delete any marked photos
        for (const photoId of photosToDelete) {
          await deleteReportPhoto(db, photoId)
        }

        // Add any newly staged photos
        if (stagedPhotos.length > 0) {
          const now = new Date().toISOString()
          for (const photo of stagedPhotos) {
            await addReportPhoto(db, {
              orgId,
              reportId: id,
              blob: photo.blob,
            })
            if (existingReport?.animal_id) {
              try {
                await db.execute(
                  `INSERT INTO photos (id, org_id, animal_id, r2_key, local_only, upload_state, capture_source, verified, created_at)
                   VALUES (?, ?, ?, NULL, 1, 'pending', 'upload', 0, ?)`,
                  [crypto.randomUUID(), orgId, existingReport.animal_id, now],
                )
              } catch (photoErr) {
                console.warn('Could not mirror photo to animal', photoErr)
              }
            }
          }
        }

        navigate(`/reports/${id}`, { replace: true })
      } else {
        const reportNumber = await generateReportNumber(db, orgInitials)
        const report = await createRescueReport(db, {
          orgId,
          reportNumber,
          category,
          species: effectiveSpecies.toLowerCase(),
          lifeStage,
          chiefComplaint: complaintTrimmed,
          city: cityTrimmed,
          locationArea: areaTrimmed,
          locationLandmark: locationLandmark.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          reporterName: reporterName.trim() || null,
          reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
          reporterCnic: reporterCnic.trim() ? formatCnic(reporterCnic) : null,
        })

        // Attach any staged photos to this report
        if (stagedPhotos.length > 0) {
          for (const photo of stagedPhotos) {
            await addReportPhoto(db, {
              orgId,
              reportId: report.id,
              blob: photo.blob,
            })
          }
        }

        navigate(`/reports/${report.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rescue report.')
      setSubmitting(false)
    }
  }

  function handleAddPhotos(newPhotos: StagedPhoto[]) {
    setStagedPhotos((prev) => [...prev, ...newPhotos])
  }

  function handleRemovePhoto(photoId: string) {
    setStagedPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  if (loadingInitial) {
    return (
      <section className="screen">
        <PageHeader
          backTo={id ? `/reports/${id}` : '/reports'}
          backLabel={id ? 'Report' : 'Reports'}
          title="Edit rescue report"
          subtitle="Loading report details…"
        />
        <p className="loading-state">Loading report details…</p>
      </section>
    )
  }

  return (
    <section className="screen screen--sticky-footer">
      <PageHeader
        backTo={isEditMode ? `/reports/${id}` : '/reports'}
        backLabel={isEditMode ? 'Report' : 'Reports'}
        title={
          isEditMode
            ? existingReport?.report_number
              ? `Edit Report ${existingReport.report_number}`
              : 'Edit rescue report'
            : 'Log a rescue report'
        }
        subtitle={
          isEditMode
            ? 'Update report details, location, or attach proof photos.'
            : 'Record incoming emergency and dispatch rescue team.'
        }
      />

      <form className="stack stack--loose" onSubmit={handleSubmit}>
        {/* 1. Animal Category & Species */}
        <div className="panel stack">
          <p className="section-label">Report Category &amp; Animal</p>

          <div className="field">
            <span>Category</span>
            <div className="filter-chips" role="group" aria-label="Report category">
              {CATEGORY_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className="chip"
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Species</span>
            <div className="filter-chips" role="group" aria-label="Animal species">
              {SPECIES_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className="chip"
                  aria-pressed={speciesPreset === item}
                  onClick={() => setSpeciesPreset(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {speciesPreset === 'Other' ? (
            <TextField
              label="Custom species"
              placeholder="e.g. Goat, Falcon, Rabbit"
              value={speciesOther}
              onChange={(e) => setSpeciesOther(e.target.value)}
              required
            />
          ) : null}

          {/* Life Stage */}
          <div className="stack stack--tight">
            <span className="field__label">Life stage</span>
            <div className="segmented" role="group" aria-label="Life stage">
              {(
                [
                  { value: 'adult', label: 'Adult' },
                  { value: 'child', label: 'Child' },
                ] as const
              ).map((stage) => (
                <button
                  key={stage.value}
                  type="button"
                  className="segmented__btn"
                  aria-pressed={lifeStage === stage.value}
                  onClick={() => setLifeStage(stage.value)}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          <TextareaField
            label="Chief complaint / Injury"
            placeholder="e.g. Hit by rickshaw • Fractured rear leg & bleeding"
            rows={3}
            value={chiefComplaint}
            onChange={(e) => {
              setChiefComplaint(e.target.value)
              if (error) setError(null)
            }}
            required
          />
        </div>

        {/* 2. Photos & Proof (Optional) */}
        <div className="panel stack">
          <div className="stack stack--tight">
            <p className="section-label">Photos &amp; Proof</p>
            <span className="field__hint">
              Optional — take or choose photos from caller or rescue scene
            </span>
          </div>

          {/* Existing Photos in Edit Mode */}
          {isEditMode && existingPhotos.length > 0 && (
            <div className="stack stack--tight" style={{ marginBottom: '8px' }}>
              <span className="field__hint" style={{ fontWeight: 600 }}>
                Existing photos:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {existingPhotos
                  .filter((p) => !photosToDelete.includes(p.id))
                  .map((p) => (
                    <div
                      key={p.id}
                      style={{
                        position: 'relative',
                        width: '4.5rem',
                        height: '4.5rem',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {existingPhotoUrls[p.id] ? (
                        <img
                          src={existingPhotoUrls[p.id]}
                          alt="Report proof"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--color-surface)',
                          }}
                        >
                          <Camera size={20} color="var(--color-ink-muted)" />
                        </div>
                      )}
                      <button
                        type="button"
                        className="pressable"
                        onClick={() => setPhotosToDelete((prev) => [...prev, p.id])}
                        title="Remove photo"
                        aria-label="Remove photo"
                        style={{
                          position: 'absolute',
                          top: '3px',
                          right: '3px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <IntakePhotoPicker
            photos={stagedPhotos}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            disabled={submitting}
          />
        </div>

        {/* 3. Location & Landmark */}
        <div className="panel stack">
          <p className="section-label">Location Details</p>

          <AutocompleteField
            label="City"
            placeholder="e.g. Lahore, Karachi, Islamabad"
            value={city}
            onChange={(val) => {
              setCity(val)
              if (error) setError(null)
            }}
            suggestions={PAKISTAN_CITIES}
            required
          />

          <AutocompleteField
            label="Area / Neighborhood"
            placeholder={
              city.toLowerCase() === 'lahore'
                ? 'e.g. Gulberg III, DHA Phase 5, Model Town'
                : 'e.g. Area or neighborhood'
            }
            value={locationArea}
            onChange={(val) => {
              setLocationArea(val)
              if (error) setError(null)
            }}
            suggestions={getAreasForCity(city)}
            required
          />

          <TextField
            label="Landmark"
            hint="optional"
            placeholder="e.g. Opposite Fresco Sweets Main Corner"
            value={locationLandmark}
            onChange={(e) => setLocationLandmark(e.target.value)}
          />

          {/* Coordinates & Map Pin (Zero-cost GPS & Link Parser) */}
          <div className="field stack stack--tight">
            <label className="field__label" style={{ margin: 0 }}>
              GPS Coordinates <span className="field__hint">· optional</span>
            </label>

            {latitude != null && longitude != null ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={16} weight="bold" color="var(--color-brand, #de6b2b)" />
                  <span className="font-mono font-medium" style={{ fontSize: '0.875rem' }}>
                    {formatCoordinates(latitude, longitude)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <a
                    href={getNavigationUrl(latitude, longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-call-mini-btn"
                    title="Test navigation in Maps"
                    style={{ textDecoration: 'none' }}
                  >
                    <Compass size={13} weight="bold" aria-hidden />
                    <span>Preview</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude(null)
                      setLongitude(null)
                      setLocationLinkInput('')
                      setLocationError(null)
                    }}
                    className="pressable"
                    title="Clear coordinates"
                    aria-label="Clear coordinates"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      color: 'var(--color-ink-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="stack stack--tight">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={detectingLocation}
                  onClick={async () => {
                    setLocationError(null)
                    setDetectingLocation(true)
                    try {
                      const pos = await requestCurrentPosition()
                      setLatitude(pos.latitude)
                      setLongitude(pos.longitude)
                    } catch (err) {
                      setLocationError(err instanceof Error ? err.message : 'Unable to acquire location')
                    } finally {
                      setDetectingLocation(false)
                    }
                  }}
                  style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {detectingLocation ? (
                    <CircleNotch size={16} weight="bold" className="photo-capture__spin" />
                  ) : (
                    <Crosshair size={16} weight="bold" />
                  )}
                  <span>{detectingLocation ? 'Detecting GPS...' : 'Detect current location'}</span>
                </Button>

                <TextField
                  label="Location link or coordinates"
                  hint="optional"
                  placeholder="Paste Google Maps or WhatsApp location link"
                  value={locationLinkInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setLocationLinkInput(val)
                    if (!val.trim()) {
                      setLocationError(null)
                      return
                    }
                    const parsed = parseCoordinates(val)
                    if (parsed) {
                      setLatitude(parsed.latitude)
                      setLongitude(parsed.longitude)
                      setLocationError(null)
                    } else if (val.includes('maps.app.goo.gl') || val.includes('goo.gl/maps')) {
                      setLocationError('Shortened links do not contain coordinates in the URL. Please open it in your browser and copy the coordinates or full URL.')
                    } else if (val.length > 15) {
                      setLocationError('Could not find latitude & longitude in text. You can also paste raw coordinates like 24.8607, 67.0011.')
                    }
                  }}
                />

                {locationError && (
                  <span className="field__hint" style={{ color: 'var(--color-danger, #b91c1c)', fontWeight: 500 }}>
                    {locationError}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Reporter Details (Confidential) */}
        <div className="panel stack">
          <div className="stack stack--tight">
            <p className="section-label">Citizen Reporter Info</p>
            <span className="field__hint">Confidential to your shelter operations</span>
          </div>

          <TextField
            label="Name"
            hint="optional"
            placeholder="e.g. Usman Ali"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
          />

          <div className="field stack stack--tight">
            <TextField
              label="Phone"
              hint="optional"
              type="tel"
              placeholder="e.g. 0300-1234567"
              value={reporterPhone}
              onChange={(e) => {
                setReporterPhone(formatPhoneNumber(e.target.value))
                if (error) setError(null)
              }}
            />
            {reporterPhone.trim() ? (
              phoneValidation.isValid ? (
                <span
                  className="field__hint"
                  style={{
                    color: 'var(--color-forest)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                  }}
                >
                  <Check size={14} weight="bold" /> Valid phone number
                </span>
              ) : (
                <span
                  className="field__hint"
                  style={{ color: 'var(--color-amber)', fontWeight: 500 }}
                >
                  {phoneValidation.error}
                </span>
              )
            ) : null}
          </div>

          <div className="field stack stack--tight">
            <TextField
              label="CNIC"
              hint="optional"
              placeholder="e.g. 42101-1234567-1"
              value={reporterCnic}
              onChange={(e) => {
                setReporterCnic(formatCnic(e.target.value))
                if (error) setError(null)
              }}
            />
            {reporterCnic.trim() ? (
              cnicValidation.isValid ? (
                <span
                  className="field__hint"
                  style={{
                    color: 'var(--color-forest)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                  }}
                >
                  <Check size={14} weight="bold" /> Valid 13-digit CNIC
                </span>
              ) : (
                <span
                  className="field__hint"
                  style={{ color: 'var(--color-amber)', fontWeight: 500 }}
                >
                  {cnicValidation.error}
                </span>
              )
            ) : null}
          </div>
        </div>

        {/* 5. Legal Action & Notice (Extra card in edit mode) */}
        {isEditMode && (category === 'cruelty' || existingReport?.legal_notes) && (
          <div className="panel stack">
            <div className="stack stack--tight">
              <p className="section-label">Legal Action &amp; Notice</p>
              <span className="field__hint">
                Official warning notice issued, Police FIR number, station, or actions taken
              </span>
            </div>
            <TextareaField
              label="Legal action details / Notice summary"
              placeholder="e.g. Warning notice issued under Animal Cruelty Act 1890, Police FIR #402/26 registered at Saddar PS. Owner instructed to cease heavy labor."
              value={legalNotes}
              onChange={(e) => setLegalNotes(e.target.value)}
              rows={4}
            />
          </div>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions">
          <Button
            type="submit"
            variant="accent"
            block
            disabled={submitting || (!isEditMode && !member)}
          >
            {submitting
              ? isEditMode
                ? 'Saving changes…'
                : 'Logging report…'
              : isEditMode
                ? 'Save changes'
                : 'Log rescue report'}
          </Button>
        </div>
      </form>
    </section>
  )
}
