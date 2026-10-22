import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, Camera } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { TextField, TextareaField } from '@/shared/ui/Field'
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
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [locationArea, setLocationArea] = useState('')
  const [locationLandmark, setLocationLandmark] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
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
        setChiefComplaint(report.chief_complaint || '')
        setLocationArea(report.location_area || '')
        setLocationLandmark(report.location_landmark || '')
        setReporterName(report.reporter_name || '')
        setReporterPhone(report.reporter_phone ? formatPhoneNumber(report.reporter_phone) : '')

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !orgId) {
      setError('Database or organization not ready.')
      return
    }

    const complaintTrimmed = chiefComplaint.trim()
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

    setSubmitting(true)
    setError(null)

    try {
      if (isEditMode && id) {
        // Update details ONLY - preserve timeline milestones, stage, and disposition
        await updateRescueReport(db, id, {
          category,
          species: effectiveSpecies.toLowerCase(),
          chiefComplaint: complaintTrimmed,
          locationArea: areaTrimmed,
          locationLandmark: locationLandmark.trim() || null,
          reporterName: reporterName.trim() || null,
          reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
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
          chiefComplaint: complaintTrimmed,
          locationArea: areaTrimmed,
          locationLandmark: locationLandmark.trim() || null,
          reporterName: reporterName.trim() || null,
          reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
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

          <TextField
            label="Location area"
            placeholder="e.g. Burns Road Food Street, Saddar, Karachi"
            value={locationArea}
            onChange={(e) => {
              setLocationArea(e.target.value)
              if (error) setError(null)
            }}
            required
          />

          <TextField
            label="Landmark"
            hint="optional"
            placeholder="e.g. Opposite Fresco Sweets Main Corner"
            value={locationLandmark}
            onChange={(e) => setLocationLandmark(e.target.value)}
          />
        </div>

        {/* 4. Reporter Details (Confidential) */}
        <div className="panel stack">
          <div className="stack stack--tight">
            <p className="section-label">Citizen Reporter Info</p>
            <span className="field__hint">Confidential to your shelter operations</span>
          </div>

          <TextField
            label="Reporter name"
            hint="optional"
            placeholder="e.g. Usman Ali"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
          />

          <div className="field stack stack--tight">
            <TextField
              label="Reporter phone"
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
        </div>

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
