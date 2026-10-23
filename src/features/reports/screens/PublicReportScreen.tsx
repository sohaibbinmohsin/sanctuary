import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  generateReportNumber,
  createRescueReport,
  addReportPhoto,
} from '@/features/reports/domain/rescueReports'
import {
  useReportDraft,
  INITIAL_DRAFT,
  type ReportDraftState,
} from '@/features/reports/hooks/useReportDraft'
import { useReporterProfile } from '@/features/reports/hooks/useReporterProfile'
import { PublicReportStepAnimal } from '@/features/reports/components/public/PublicReportStepAnimal'
import {
  PublicReportStepLocation,
  type PublicPhotoItem,
} from '@/features/reports/components/public/PublicReportStepLocation'
import { PublicReportStepContact } from '@/features/reports/components/public/PublicReportStepContact'
import { useReportSeo } from '@/features/reports/domain/reportSeo'
import '@/features/reports/publicReport.css'

const STEPS = [
  { step: 1, label: 'Animal' },
  { step: 2, label: 'Location' },
  { step: 3, label: 'Contact' },
] as const

export function PublicReportScreen() {
  useReportSeo()
  const navigate = useNavigate()
  const db = useDb()
  const { draft, updateDraft, clearDraft } = useReportDraft()
  const { profile, saveProfile } = useReporterProfile()

  const [photos, setPhotos] = useState<PublicPhotoItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const patch: Partial<ReportDraftState> = {}
    if (!draft.reporterPhone.trim() && profile.phone) {
      patch.reporterPhone = profile.phone
    }
    if (!draft.reporterName.trim() && profile.name) {
      patch.reporterName = profile.name
    }
    if (!draft.reporterCnic.trim() && profile.cnic) {
      patch.reporterCnic = profile.cnic
    }
    if ((!draft.city.trim() || draft.city === INITIAL_DRAFT.city) && profile.city) {
      patch.city = profile.city
    }
    if (Object.keys(patch).length > 0) {
      updateDraft(patch)
    }
  }, [profile])

  const handleAddPhotos = useCallback((newPhotos: PublicPhotoItem[]) => {
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5))
  }, [])

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  async function handleSubmit(e: FormEvent, honeypotValue: string) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Honeypot security trap check
    if (honeypotValue.trim() !== '') {
      clearDraft()
      setSubmitting(false)
      navigate('/report/track/SANCTUARY-R000')
      return
    }

    try {
      let reportNumber = `SANCTUARY-R${Math.floor(100 + Math.random() * 900)}`
      if (db) {
        try {
          const gen = await generateReportNumber(db, 'SANCTUARY')
          if (gen) reportNumber = gen
        } catch {}
      }

      const effectiveSpecies =
        draft.speciesPreset === 'Other'
          ? draft.speciesOther.trim() || 'Other'
          : draft.speciesPreset === 'Bird' && draft.avianSubtype
            ? `Bird (${draft.avianSubtype})`
            : draft.speciesPreset

      let savedReport = null
      if (db) {
        try {
          savedReport = await createRescueReport(db, {
            orgId: 'sanctuary-public',
            reportNumber,
            category: draft.category,
            species: effectiveSpecies,
            lifeStage: draft.intakeCountMode === 'litter' ? null : draft.lifeStage,
            chiefComplaint: draft.chiefComplaint,
            city: draft.city,
            locationArea: draft.locationArea,
            locationLandmark: draft.locationLandmark || null,
            latitude: draft.latitude,
            longitude: draft.longitude,
            reporterName: draft.reporterName || null,
            reporterPhone: draft.reporterPhone || null,
            reporterCnic: draft.reporterCnic || null,
            intakeSource: 'citizen',
            animalCount: draft.animalCount,
          })
          if (savedReport && photos.length > 0) {
            for (const item of photos) {
              if (item.blob) {
                try {
                  await addReportPhoto(db, {
                    orgId: 'sanctuary-public',
                    reportId: savedReport.id,
                    blob: item.blob,
                  })
                } catch (photoErr) {
                  console.warn('Could not attach photo to report:', photoErr)
                }
              }
            }
          }
        } catch (dbErr) {
          console.warn('Could not persist report to local database:', dbErr)
        }
      }

      const now = new Date().toISOString()
      const photoPayload = photos.map((p) => ({
        id: p.id,
        url: p.url,
      }))

      const fallbackReport = {
        id: crypto.randomUUID(),
        org_id: 'sanctuary-public',
        report_number: reportNumber,
        category: draft.category || 'emergency',
        species: effectiveSpecies,
        life_stage: draft.intakeCountMode === 'litter' ? null : draft.lifeStage,
        chief_complaint: draft.chiefComplaint,
        status: 'logged',
        city: draft.city || 'Lahore',
        location_area: draft.locationArea,
        location_landmark: draft.locationLandmark || null,
        latitude: draft.latitude,
        longitude: draft.longitude,
        reporter_name: draft.reporterName || null,
        reporter_phone: draft.reporterPhone || null,
        reporter_cnic: draft.reporterCnic || null,
        intake_source: 'citizen',
        animal_count: draft.animalCount,
        photos: photoPayload,
        stage_logged_at: now,
        created_at: now,
        updated_at: now,
      }

      const reportToCache = {
        ...(savedReport || fallbackReport),
        photos: photoPayload,
      }

      try {
        const raw = localStorage.getItem('sanctuary_public_reports_v1')
        let cacheMap: Record<string, any> = {}
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.report_number) {
                cacheMap[item.report_number] = item
              }
            }
          } else if (typeof parsed === 'object' && parsed !== null) {
            cacheMap = parsed
          }
        }
        cacheMap[reportNumber] = reportToCache
        localStorage.setItem('sanctuary_public_reports_v1', JSON.stringify(cacheMap))
      } catch {}

      if (draft.rememberProfile && draft.reporterPhone.trim()) {
        saveProfile({
          name: draft.reporterName,
          phone: draft.reporterPhone,
          cnic: draft.reporterCnic,
          city: draft.city,
        })
      }

      clearDraft()
      setSubmitting(false)
      navigate(`/report/track/${reportNumber}`)
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Failed to submit report.')
    }
  }

  return (
    <div className="public-report">
      <header className="public-report__header">
        <Link to="/" className="public-report__brand" aria-label="Sanctuary Home">
          <img src="/sanctuary-logo.svg" alt="" width={36} height={36} />
          <span>Sanctuary</span>
        </Link>
      </header>

      <main className="public-report__main">
        <div className="public-report__card">
          <div className="public-report__intro">
            <h1 className="public-report__title">Report an Animal in Distress</h1>
            <p className="public-report__subtitle">
              Emergency intake is dispatched directly to nearby partner rescue units and field responders.
            </p>
          </div>

          <nav className="public-report__progress" aria-label="Intake progress">
            <ol className="public-report__steps">
              {STEPS.map((s) => {
                const isActive = draft.currentStep === s.step
                const isCompleted = draft.currentStep > s.step
                return (
                  <li
                    key={s.step}
                    className={`public-report__step-item${isActive ? ' public-report__step-item--active' : ''}${isCompleted ? ' public-report__step-item--completed' : ''}`}
                  >
                    <button
                      type="button"
                      className="public-report__step-trigger"
                      disabled={s.step > draft.currentStep}
                      onClick={() => {
                        if (s.step < draft.currentStep) {
                          updateDraft({ currentStep: s.step })
                        }
                      }}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      <span className="public-report__step-number">
                        {isCompleted ? <Check size={14} weight="bold" aria-hidden /> : s.step}
                      </span>
                      <span className="public-report__step-title">{s.label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className="public-report__content">
            {draft.currentStep === 1 && (
              <PublicReportStepAnimal
                draft={draft}
                onUpdate={updateDraft}
                onNext={() => updateDraft({ currentStep: 2 })}
              />
            )}
            {draft.currentStep === 2 && (
              <PublicReportStepLocation
                draft={draft}
                photos={photos}
                onUpdate={updateDraft}
                onAddPhotos={handleAddPhotos}
                onRemovePhoto={handleRemovePhoto}
                onBack={() => updateDraft({ currentStep: 1 })}
                onNext={() => updateDraft({ currentStep: 3 })}
              />
            )}
            {draft.currentStep === 3 && (
              <PublicReportStepContact
                draft={draft}
                photos={photos}
                submitting={submitting}
                error={error}
                onUpdate={updateDraft}
                onBack={() => updateDraft({ currentStep: 2 })}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
