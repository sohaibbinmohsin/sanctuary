import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X } from '@phosphor-icons/react'
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
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  PublicReportStepLocation,
  type PublicPhotoItem,
} from '@/features/reports/components/public/PublicReportStepLocation'
import { PublicReportStepContact } from '@/features/reports/components/public/PublicReportStepContact'
import { useReportSeo } from '@/features/reports/domain/reportSeo'
import { useReportLanguage } from '@/features/reports/hooks/useReportLanguage'
import { formatReportNumber } from './PublicReportTrackScreen'
import '@/features/reports/publicReport.css'

export interface PublicReportScreenProps {
  minSubmissionDurationMs?: number
}

export function PublicReportScreen({ minSubmissionDurationMs }: PublicReportScreenProps = {}) {
  useReportSeo()
  const navigate = useNavigate()
  const db = useDb()
  const { member } = useCurrentMember()
  const targetOrgId = member?.orgId || 'sanctuary-public'
  const orgInitials = member?.orgInitials || 'Sanctuary'
  const { lang, toggleLang, isRtl, t } = useReportLanguage()
  const { draft, updateDraft, clearDraft } = useReportDraft()
  const { profile, saveProfile } = useReporterProfile()
  const formMountedAtRef = useRef<number>(Date.now())
  const stableReportNumberRef = useRef<string>(
    `${orgInitials}-R${Math.floor(100 + Math.random() * 900)}`
  )
  const effectiveMinDuration = minSubmissionDurationMs ?? (process.env.NODE_ENV === 'test' ? 0 : 2500)

  const STEPS = [
    { step: 1, label: t.stepPhotosLocation },
    { step: 2, label: t.stepContactSubmit },
  ] as const

  const [photos, setPhotos] = useState<PublicPhotoItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Early background logging: Once Step 1 is completed (currentStep 2),
  // record an early snapshot in local report cache so data is never lost.
  useEffect(() => {
    if (draft.currentStep < 2 || photos.length === 0) return

    const reportNumber = stableReportNumberRef.current
    const now = new Date().toISOString()
    const photoPayload = photos.map((p) => ({
      id: p.id,
      url: p.url,
    }))

    const fallbackComplaint =
      draft.category === 'cruelty'
        ? 'Animal cruelty report with visual evidence'
        : 'Sick or injured animal report with visual evidence'
    const effectiveComplaint = draft.chiefComplaint.trim() || fallbackComplaint

    const earlySnapshot = {
      id: crypto.randomUUID(),
      org_id: targetOrgId,
      report_number: reportNumber,
      category: draft.category || 'sick_injured',
      species: draft.speciesPreset || 'Rescue Animal',
      life_stage: draft.intakeCountMode === 'litter' ? null : draft.lifeStage,
      chief_complaint: effectiveComplaint,
      status: 'logged',
      city: draft.city || 'Lahore',
      location_area: draft.locationArea || 'Location captured',
      location_landmark: draft.locationLandmark || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
      reporter_name: draft.reporterName || null,
      reporter_phone: draft.reporterPhone || null,
      reporter_cnic: draft.reporterCnic || null,
      intake_source: 'citizen',
      animal_count: draft.animalCount || 1,
      group_breakdown: draft.groupBreakdown || null,
      ai_analysis: draft.aiAnalysis || null,
      photos: photoPayload,
      stage_logged_at: now,
      created_at: now,
      updated_at: now,
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
      cacheMap[reportNumber] = earlySnapshot
      localStorage.setItem('sanctuary_public_reports_v1', JSON.stringify(cacheMap))
    } catch {}
  }, [draft.currentStep, photos, draft])

  const handleClose = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    const prevOverflow = document.body.style.overflow
    const prevOverflowX = document.documentElement.style.overflowX
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflowX = 'hidden'
    window.scrollTo({ left: 0 })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
      document.documentElement.style.overflowX = prevOverflowX
      window.scrollTo({ left: 0 })
    }
  }, [handleClose])

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

    // Honeypot security trap and rapid bot submission time-gate check
    const elapsedMs = Date.now() - formMountedAtRef.current
    if (honeypotValue.trim() !== '' || elapsedMs < effectiveMinDuration) {
      clearDraft()
      try {
        const raw = localStorage.getItem('sanctuary_public_reports_v1')
        if (raw) {
          const map = JSON.parse(raw)
          delete map[stableReportNumberRef.current]
          if (Object.keys(map).length === 0) {
            localStorage.removeItem('sanctuary_public_reports_v1')
          } else {
            localStorage.setItem('sanctuary_public_reports_v1', JSON.stringify(map))
          }
        }
      } catch {}
      setSubmitting(false)
      navigate('/report/track/000')
      return
    }

    try {
      let reportNumber = stableReportNumberRef.current
      if (db) {
        try {
          const gen = await generateReportNumber(db, orgInitials)
          if (gen) reportNumber = gen
        } catch {}
      }

      const fallbackComplaint =
        draft.category === 'cruelty'
          ? 'Animal cruelty report with visual evidence'
          : 'Sick or injured animal report with visual evidence'
      const effectiveComplaint = draft.chiefComplaint.trim() || fallbackComplaint

      const effectiveSpecies =
        draft.speciesPreset === 'Other'
          ? draft.speciesOther.trim() || 'Rescue Animal'
          : draft.speciesPreset === 'Bird' && draft.avianSubtype
            ? `Bird (${draft.avianSubtype})`
            : draft.speciesPreset || 'Rescue Animal'

      let savedReport = null
      if (db) {
        try {
          savedReport = await createRescueReport(db, {
            orgId: targetOrgId,
            reportNumber,
            category: draft.category,
            species: effectiveSpecies,
            lifeStage: draft.intakeCountMode === 'litter' ? null : draft.lifeStage,
            chiefComplaint: effectiveComplaint,
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
            groupBreakdown: draft.groupBreakdown || null,
          })
          if (savedReport && photos.length > 0) {
            for (const item of photos) {
              if (item.blob) {
                try {
                  await addReportPhoto(db, {
                    orgId: targetOrgId,
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
        org_id: targetOrgId,
        report_number: reportNumber,
        category: draft.category || 'sick_injured',
        species: effectiveSpecies,
        life_stage: draft.intakeCountMode === 'litter' ? null : draft.lifeStage,
        chief_complaint: effectiveComplaint,
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
        group_breakdown: draft.groupBreakdown || null,
        ai_analysis: draft.aiAnalysis || null,
        photos: photoPayload,
        stage_logged_at: now,
        created_at: now,
        updated_at: now,
      }

      const reportToCache = {
        ...(savedReport || fallbackReport),
        group_breakdown: draft.groupBreakdown || null,
        ai_analysis: draft.aiAnalysis || null,
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
        if (reportNumber !== stableReportNumberRef.current) {
          delete cacheMap[stableReportNumberRef.current]
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
      navigate(`/report/track/${formatReportNumber(reportNumber)}`)
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Failed to submit report.')
    }
  }

  return (
    <div
      className="public-report__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
      role="presentation"
    >
      <div
        className="public-report__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-report-dialog-title"
        dir={isRtl ? 'rtl' : 'ltr'}
        lang={lang}
      >
        <header className="public-report__dialog-header">
          <div className="public-report__brand-group">
            <Link to="/" className="public-report__brand" aria-label="Sanctuary Home">
              <img src="/sanctuary-logo.svg" alt="" width={32} height={32} />
              <span>{t.sanctuary}</span>
            </Link>
            <button
              type="button"
              className="public-lang-pill"
              onClick={toggleLang}
              aria-label="Switch language"
            >
              {t.switchLangText}
            </button>
          </div>
          <button
            type="button"
            className="public-report__close"
            onClick={handleClose}
            aria-label="Close report dialog"
          >
            <X size={20} weight="bold" />
          </button>
        </header>

        <div className="public-report__dialog-body">
          <div className="public-report__intro">
            <h1 id="public-report-dialog-title" className="public-report__title">
              {t.modalTitle}
            </h1>
            <p className="public-report__subtitle">
              {t.modalSubtitle}
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
              <PublicReportStepLocation
                draft={draft}
                photos={photos}
                onUpdate={updateDraft}
                onAddPhotos={handleAddPhotos}
                onRemovePhoto={handleRemovePhoto}
                onNext={() => updateDraft({ currentStep: 2 })}
                lang={lang}
                t={t}
              />
            )}
            {draft.currentStep === 2 && (
              <PublicReportStepContact
                draft={draft}
                photos={photos}
                submitting={submitting}
                error={error}
                onUpdate={updateDraft}
                onBack={() => updateDraft({ currentStep: 1 })}
                onSubmit={handleSubmit}
                lang={lang}
                t={t}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
