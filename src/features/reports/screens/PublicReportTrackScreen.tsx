import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Siren,
  Clock,
  MapPin,
  ShieldCheck,
  Heart,
  Scales,
  FileText,
  CaretDown,
  Sparkle,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { maskPhoneNumber, maskCnic } from '@/features/reports/domain/privacyMask'
import { useReportTrackSeo } from '@/features/reports/domain/reportSeo'
import {
  extractCaseNumber,
  resolveRescuingPartner,
  getTrackingNotice,
} from '@/features/reports/domain/partners'
import { SanctuaryFooter } from '@/shared/ui/SanctuaryFooter'
import { useReportLanguage } from '@/features/reports/hooks/useReportLanguage'
import {
  EMERGENCY_PIPELINE_STAGES,
  CRUELTY_PIPELINE_STAGES,
  type PipelineStageTranslation,
  translateSpecies,
  translateLifeStage,
  formatAnimalCount,
} from '@/features/reports/domain/reportTranslations'
import '@/features/reports/publicReport.css'

const STAGE_ORDER: Record<string, number> = {
  logged: 0,
  accepted: 1,
  dispatched: 2,
  attended: 3,
  resolved: 4,
}

function getStatusBadgeText(status?: string | null, isCruelty = false, isUrdu = false): string {
  if (!status) return isCruelty ? (isUrdu ? 'شکایت درج' : 'Complaint Logged') : (isUrdu ? 'درج شدہ' : 'Logged')
  const s = status.toLowerCase()
  if (isCruelty) {
    if (s === 'logged') return isUrdu ? 'شکایت درج' : 'Complaint Logged'
    if (s === 'accepted') return isUrdu ? 'تحقیقات جاری' : 'Investigation'
    if (s === 'dispatched') return isUrdu ? 'قانونی کارروائی' : 'Notice / Legal Action'
    if (s === 'attended') return isUrdu ? 'حفاظتی تحویل' : 'In Custody'
    if (s === 'resolved' || s === 'completed') return isUrdu ? 'حل شدہ' : 'Resolved'
  } else {
    if (s === 'logged') return isUrdu ? 'درج شدہ' : 'Logged'
    if (s === 'accepted') return isUrdu ? 'منظور شدہ' : 'Accepted'
    if (s === 'dispatched') return isUrdu ? 'ٹیم روانہ' : 'Dispatched'
    if (s === 'attended') return isUrdu ? 'مقام پر آمد' : 'Attended'
    if (s === 'resolved' || s === 'completed') return isUrdu ? 'حل شدہ' : 'Resolved'
  }
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatReportNumber(raw?: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D+/g, '')
  if (digits) return digits
  return raw
}

export interface StageTimestamp {
  date: string
  time: string
}

export function formatStageTimestamp(isoString?: string | null): StageTimestamp | null {
  if (!isoString) return null
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return null
    const nowYear = new Date().getFullYear()
    const date = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== nowYear ? { year: 'numeric' } : {}),
    })
    const time = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
    return { date, time }
  } catch {
    return null
  }
}

function getStageTimestamp(
  stage: PipelineStageTranslation,
  report: Record<string, any>,
  isResolved: boolean
): StageTimestamp | null {
  let val = report[stage.timeKey]
  if (!val && stage.key === 'logged') {
    val = report.created_at
  }
  if (!val && stage.key === 'resolved' && isResolved) {
    val = report.updated_at
  }
  return formatStageTimestamp(val)
}

export function PublicReportTrackScreen() {
  const { reportNumber } = useParams<{ reportNumber: string }>()
  const navigate = useNavigate()
  const db = useDb()
  const { lang, toggleLang, isRtl, t } = useReportLanguage()
  const [report, setReport] = useState<Record<string, any> | null>(null)
  useReportTrackSeo(reportNumber, report?.status)
  const [photos, setPhotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const loadedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (reportNumber) {
      const formatted = formatReportNumber(reportNumber)
      if (formatted && formatted !== reportNumber) {
        navigate(`/report/track/${formatted}`, { replace: true })
      }
    }
  }, [reportNumber, navigate])

  useEffect(() => {
    let isMounted = true

    if (loadedKeyRef.current === reportNumber && report) {
      return
    }

    async function loadCase() {
      if (!reportNumber) {
        if (isMounted) setLoading(false)
        return
      }

      if (loadedKeyRef.current !== reportNumber) {
        setLoading(true)
      }
      let fetchedReport: Record<string, any> | null = null
      let fetchedPhotos: any[] = []

      const searchKey = (reportNumber || '').trim()
      const digits = searchKey.replace(/\D+/g, '')
      const sanctuaryKey = digits ? `Sanctuary-R${digits}` : searchKey
      const upperSanctuaryKey = digits ? `SANCTUARY-R${digits}` : searchKey
      const altKey = /^sanctuary-/i.test(searchKey)
        ? (searchKey.startsWith('Sanctuary-')
            ? 'SANCTUARY-' + searchKey.slice('Sanctuary-'.length)
            : 'Sanctuary-' + searchKey.slice('sanctuary-'.length))
        : searchKey

      // 1. Try DB first
      if (db) {
        try {
          if (typeof db.getOptional === 'function') {
            fetchedReport = await db.getOptional(
              'SELECT * FROM rescue_reports WHERE report_number = ? OR report_number = ? OR report_number = ? OR report_number = ?',
              [searchKey, altKey, sanctuaryKey, upperSanctuaryKey]
            )
          } else if (typeof db.getAll === 'function') {
            const rows = await db.getAll(
              'SELECT * FROM rescue_reports WHERE report_number = ? OR report_number = ? OR report_number = ? OR report_number = ?',
              [searchKey, altKey, sanctuaryKey, upperSanctuaryKey]
            )
            fetchedReport = rows?.[0] || null
          }

          if (fetchedReport?.id && typeof db.getAll === 'function') {
            const rawDbPhotos = await db.getAll<any>(
              'SELECT * FROM report_photos WHERE report_id = ? ORDER BY created_at ASC',
              [fetchedReport.id]
            )
            if (Array.isArray(rawDbPhotos) && rawDbPhotos.length > 0) {
              const resolved = []
              for (const p of rawDbPhotos) {
                try {
                  const blob = await getLocalPhoto(p.id)
                  if (blob) {
                    resolved.push({ ...p, url: URL.createObjectURL(blob) })
                    continue
                  }
                } catch {}
                resolved.push(p)
              }
              fetchedPhotos = resolved
            }
          }
        } catch {
          // Fall back to local storage
        }
      }

      // 2. Fall back to localStorage if not found in DB
      if (!fetchedReport) {
        try {
          const raw = localStorage.getItem('sanctuary_public_reports_v1')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
              fetchedReport =
                parsed.find(
                  (item: any) =>
                    item &&
                    (item.report_number === searchKey ||
                      item.report_number === altKey ||
                      item.report_number === sanctuaryKey ||
                      item.report_number === upperSanctuaryKey ||
                      item.reportNumber === searchKey ||
                      item.reportNumber === altKey ||
                      (digits && String(item.report_number || '').replace(/\D+/g, '') === digits))
                ) || null
            } else if (parsed && typeof parsed === 'object') {
              fetchedReport =
                parsed[searchKey] ||
                parsed[altKey] ||
                parsed[sanctuaryKey] ||
                parsed[upperSanctuaryKey] ||
                null
              if (!fetchedReport && digits) {
                fetchedReport =
                  Object.values(parsed).find(
                    (item: any) =>
                      item &&
                      String(item.report_number || item.reportNumber || '').replace(/\D+/g, '') === digits
                  ) || null
              }
            }
          }
        } catch {
          // Ignore json parse error
        }
      }

      // 3. Demo fallback for Sanctuary-R101 / Sanctuary-R000
      if (
        !fetchedReport &&
        (searchKey.toLowerCase() === 'sanctuary-r101' ||
          searchKey.toLowerCase() === 'sanctuary-r000' ||
          digits === '101' ||
          digits === '000')
      ) {
        fetchedReport = {
          id: 'demo-r101',
          report_number: 'Sanctuary-R101',
          status: 'logged',
          species: 'Dog',
          animal_count: 1,
          life_stage: 'adult',
          chief_complaint: 'Hit by vehicle',
          city: 'Lahore',
          location_area: 'Gulberg I',
          location_landmark: 'None',
          reporter_name: 'Anonymous',
          reporter_phone: '03331234333',
          reporter_cnic: '',
          stage_logged_at: '2026-10-25T16:57:00Z',
          created_at: '2026-10-25T16:57:00Z',
        }
      }

      if (
        !fetchedReport &&
        (searchKey.toLowerCase() === 'sanctuary-r102' || digits === '102')
      ) {
        fetchedReport = {
          id: 'demo-r102',
          report_number: 'Sanctuary-R102',
          report_type: 'cruelty',
          category: 'cruelty',
          status: 'logged',
          species: 'Dog',
          animal_count: 1,
          life_stage: 'adult',
          chief_complaint: 'Physical abuse or beating',
          city: 'Lahore',
          location_area: 'Gulberg I',
          location_landmark: 'None',
          reporter_name: 'Anonymous',
          reporter_phone: '03001234333',
          reporter_cnic: '',
          stage_logged_at: '2026-10-26T20:25:00Z',
          created_at: '2026-10-26T20:25:00Z',
        }
      }

      if (
        fetchedReport?.photos &&
        Array.isArray(fetchedReport.photos) &&
        fetchedPhotos.length === 0
      ) {
        fetchedPhotos = fetchedReport.photos
      }

      if (isMounted) {
        loadedKeyRef.current = reportNumber
        setReport(fetchedReport)
        setPhotos(fetchedPhotos)
        setLoading(false)
      }
    }

    void loadCase()

    return () => {
      isMounted = false
    }
  }, [db, reportNumber])

  async function handleCopyLink() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        const canonicalUrl =
          typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
            ? `${window.location.origin}/report/track/${caseNumber || reportNumber}`
            : window.location.href
        await navigator.clipboard.writeText(canonicalUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Clipboard write fallback
    }
  }

  if (loading) {
    return (
      <div className="public-track-page" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
        <header className="public-track-page__header">
          <div className="public-track-page__header-inner">
            <div className="public-track-page__brand-group">
              <Link to="/" className="public-track-page__brand" aria-label="Sanctuary Home">
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
          </div>
        </header>
        <main className="public-track-page__main">
          <div className="public-track-page__container">
            <div className="public-track-card">
              <div className="public-track">
                <div className="public-track__header-row">
                  <div className="public-track-skeleton" style={{ width: 140, height: 28, borderRadius: 9999 }} />
                  <div className="public-track-skeleton" style={{ width: 88, height: 28, borderRadius: 9999 }} />
                </div>
                <div className="public-track-skeleton" style={{ width: '100%', height: 48, borderRadius: 'var(--radius-md)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4) 0' }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                      <div className="public-track-skeleton" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                      <div className="public-track-skeleton" style={{ width: 48, height: 12 }} />
                    </div>
                  ))}
                </div>
                <div className="public-track__section">
                  <div className="public-track-skeleton" style={{ width: 120, height: 16 }} />
                  <div className="public-track-skeleton" style={{ width: '85%', height: 20 }} />
                </div>
                <div className="public-track__section">
                  <div className="public-track-skeleton" style={{ width: 110, height: 16 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div className="public-track-skeleton" style={{ height: 36 }} />
                    <div className="public-track-skeleton" style={{ height: 36 }} />
                    <div className="public-track-skeleton" style={{ height: 36 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <SanctuaryFooter />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="public-track-page" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
        <header className="public-track-page__header">
          <div className="public-track-page__header-inner">
            <div className="public-track-page__brand-group">
              <Link to="/" className="public-track-page__brand" aria-label="Sanctuary Home">
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
          </div>
        </header>
        <main className="public-track-page__main">
          <div className="public-track-page__container">
            <div className="public-track-card">
              <div className="public-track__not-found">
                <Siren size={44} className="public-track__not-found-icon" aria-hidden />
                <h2 className="public-track__not-found-title">{t.caseNotFoundTitle}</h2>
                <p className="public-track__not-found-desc">{t.caseNotFoundDesc}</p>
                <div
                  className="public-track__actions-row"
                  style={{ borderTop: 'none', justifyContent: 'center' }}
                >
                  <Link to="/report" className="public-track__btn public-track__btn--primary">
                    {isRtl ? <ArrowRight size={16} aria-hidden /> : <ArrowLeft size={16} aria-hidden />}
                    <span>{t.reportEmergency}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
        <SanctuaryFooter />
      </div>
    )
  }

  const isCruelty = (report.category || '').toLowerCase() === 'cruelty'
  const isUrdu = lang === 'ur'
  const pipelineStages = isCruelty ? CRUELTY_PIPELINE_STAGES : EMERGENCY_PIPELINE_STAGES

  const normalizedStatus = (report.status || 'logged').toLowerCase()
  const isResolved =
    normalizedStatus === 'resolved' ||
    normalizedStatus === 'completed' ||
    normalizedStatus === 'admitted_shelter' ||
    normalizedStatus === 'spot_released'
  const activeStageIndex = isResolved ? 4 : (STAGE_ORDER[normalizedStatus] ?? 0)

  const statusBadgeText = getStatusBadgeText(report.status, isCruelty, isUrdu)
  const maskedPhone = maskPhoneNumber(report.reporter_phone)
  const maskedCnic = maskCnic(report.reporter_cnic)
  const animalCount = Number(report.animal_count) || 1
  const countText = formatAnimalCount(animalCount, isUrdu)
  const speciesText = translateSpecies(report.species, isUrdu)
  const lifeStageText = translateLifeStage(report.life_stage, isUrdu)

  const caseNumber = extractCaseNumber(report.report_number || reportNumber)
  const notice = getTrackingNotice(report)
  const partner = resolveRescuingPartner(report)

  let noticeHeadline = notice.headline
  let noticeBody = notice.body
  let noticeSubtext = notice.subtext
  let noticeAdvocacy = notice.advocacyNote

  if (isUrdu) {
    if (notice.type === 'resolved') {
      noticeHeadline = t.noticeResolvedTitle
      noticeBody = t.noticeResolvedBody
      noticeSubtext = isCruelty ? t.noticeSubtextCruelty : t.noticeSubtextEmergency
    } else if (notice.type === 'active') {
      noticeHeadline = t.noticeActiveTitle
      noticeBody = isCruelty ? t.noticeActiveCrueltyBody : t.noticeActiveBody
      noticeSubtext = isCruelty ? t.noticeSubtextCruelty : t.noticeSubtextEmergency
    } else if (notice.type === 'queued') {
      noticeHeadline = t.noticeQueuedTitle
      noticeBody = isCruelty ? t.noticeQueuedCrueltyBody : t.noticeQueuedBody
      noticeSubtext = isCruelty ? t.noticeSubtextCruelty : t.noticeSubtextEmergency
      if (noticeAdvocacy) noticeAdvocacy = t.advocacyBody
    } else if (notice.type === 'extended') {
      noticeHeadline = t.noticeExtendedTitle
      noticeBody = isCruelty ? t.noticeExtendedCrueltyBody : t.noticeExtendedBody
      noticeSubtext = isCruelty ? t.noticeSubtextCruelty : t.noticeSubtextEmergency
      if (noticeAdvocacy) noticeAdvocacy = t.advocacyBody
    } else {
      noticeHeadline = t.noticeFreshTitle
      noticeBody = isCruelty ? t.noticeFreshCrueltyBody : t.noticeFreshBody
      noticeSubtext = isCruelty ? t.noticeSubtextCruelty : t.noticeSubtextEmergency
    }
  } else if (isCruelty) {
    if (notice.type === 'resolved') {
      noticeHeadline = t.noticeResolvedTitle
      noticeBody = t.noticeResolvedBody
      noticeSubtext = t.noticeSubtextCruelty
    } else if (notice.type === 'active') {
      noticeHeadline = t.noticeActiveTitle
      noticeBody = t.noticeActiveCrueltyBody
      noticeSubtext = t.noticeSubtextCruelty
    } else if (notice.type === 'queued') {
      noticeHeadline = t.noticeQueuedTitle
      noticeBody = t.noticeQueuedCrueltyBody
      noticeSubtext = t.noticeSubtextCruelty
    } else if (notice.type === 'extended') {
      noticeHeadline = t.noticeExtendedTitle
      noticeBody = t.noticeExtendedCrueltyBody
      noticeSubtext = t.noticeSubtextCruelty
    } else {
      noticeHeadline = t.noticeFreshTitle
      noticeBody = t.noticeFreshCrueltyBody
      noticeSubtext = t.noticeSubtextCruelty
    }
  }

  const coordinatesText =
    typeof report.latitude === 'number' && typeof report.longitude === 'number'
      ? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
      : null

  return (
    <div className="public-track-page" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
      <header className="public-track-page__header">
        <div className="public-track-page__header-inner">
          <div className="public-track-page__brand-group">
            <Link to="/" className="public-track-page__brand" aria-label="Sanctuary Home">
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
        </div>
      </header>

      <main className="public-track-page__main">
        <div className="public-track-page__container">
          <div className="public-track-card">
            <div className="public-track">
              <div className="public-track__header-row">
                <div className="public-track__heading-group">
                  <span className="public-track__case-label">{t.rescueReport}</span>
                  <h1 className="public-track__case-heading">{t.caseNumberLabel}{caseNumber}</h1>
                </div>
                <span
                  className={`public-track__status-badge public-track__status-badge--${normalizedStatus}`}
                >
                  {statusBadgeText}
                </span>
              </div>

              <div className="public-track__pipeline">
                <ol
                  className="public-track__pipeline-list"
                  style={
                    {
                      '--pipeline-progress': `${(isResolved ? 4 : activeStageIndex) * 20}%`,
                    } as React.CSSProperties
                  }
                >
                  {pipelineStages.map((stage, idx) => {
                    const isCompleted = isResolved ? true : idx < activeStageIndex
                    const isActive = !isResolved && idx === activeStageIndex
                    const stamp = getStageTimestamp(stage, report, isResolved)
                    const stageLabel = isUrdu ? stage.labelUr : stage.labelEn

                    let stepClass = 'public-track__pipeline-step'
                    if (isCompleted) stepClass += ' public-track__pipeline-step--completed'
                    if (isActive) stepClass += ' public-track__pipeline-step--active'

                    let indicatorClass = 'public-track__indicator'
                    if (isCompleted) indicatorClass += ' public-track__indicator--completed'
                    else if (isActive) indicatorClass += ' public-track__indicator--active'
                    else indicatorClass += ' public-track__indicator--pending'

                    return (
                      <li key={stage.key} className={stepClass}>
                        <div className={indicatorClass}>
                          {isCompleted ? (
                            <Check size={14} weight="bold" aria-label={`Completed: ${stageLabel}`} />
                          ) : isActive ? (
                            <Clock size={14} weight="bold" aria-label={`Active: ${stageLabel}`} />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>
                        <div className="public-track__step-body">
                          <span className="public-track__step-label">{stageLabel}</span>
                          {stamp && (
                            <span className="public-track__step-time">
                              <span className="public-track__step-date">{stamp.date}</span>
                              <span className="public-track__step-sep">·</span>
                              <span className="public-track__step-clock">{stamp.time}</span>
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>

              <div className={`public-track__notice public-track__notice--${notice.type}`}>
                <div className="public-track__notice-header">
                  {notice.type === 'resolved' ? (
                    <Check size={18} weight="bold" className="public-track__notice-header-icon" aria-hidden />
                  ) : notice.type === 'active' ? (
                    <Heart size={18} weight="fill" className="public-track__notice-header-icon" aria-hidden />
                  ) : notice.type === 'queued' ? (
                    <Clock size={18} weight="bold" className="public-track__notice-header-icon" aria-hidden />
                  ) : notice.type === 'extended' ? (
                    <Scales size={18} weight="bold" className="public-track__notice-header-icon" aria-hidden />
                  ) : (
                    <Sparkle size={18} weight="fill" className="public-track__notice-header-icon" aria-hidden />
                  )}
                  <h2 className="public-track__notice-title">{noticeHeadline}</h2>
                </div>
                <p className="public-track__notice-body">{noticeBody}</p>
                {noticeSubtext && (
                  <p className="public-track__notice-subtext">{noticeSubtext}</p>
                )}
                {noticeAdvocacy && (
                  <div className="public-track__notice-advocacy">
                    <Scales size={18} weight="bold" className="public-track__notice-advocacy-icon" aria-hidden />
                    <span>{noticeAdvocacy}</span>
                  </div>
                )}
              </div>

              {partner ? (
                <div className="public-track__rescuer-card">
                  <div className="public-track__rescuer-content">
                    <div className="public-track__rescuer-header">
                      <img
                        src={partner.logoUrl}
                        alt={`${partner.name} logo`}
                        className="public-track__rescuer-logo"
                        width={52}
                        height={52}
                      />
                      <div className="public-track__rescuer-meta">
                        <div className="public-track__rescuer-badge">
                          <ShieldCheck size={14} weight="bold" aria-hidden />
                          <span>{t.assignedRespondingUnit}</span>
                        </div>
                        <h3 className="public-track__rescuer-name">{partner.name}</h3>
                        <span className="public-track__rescuer-region">{partner.region}</span>
                      </div>
                    </div>
                    <p className="public-track__rescuer-desc">{partner.description}</p>
                    <div className="public-track__rescuer-actions">
                      <a
                        href={partner.socialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="public-track__rescuer-btn"
                      >
                        <span>{t.supportAndFollow}</span>
                        <ArrowSquareOut size={13} weight="bold" aria-hidden />
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              <details className="public-track__details">
                <summary className="public-track__details-summary">
                  <div className="public-track__details-title">
                    <FileText size={18} weight="bold" aria-hidden />
                    <span>{t.viewSubmittedDetails}</span>
                  </div>
                  <CaretDown size={16} weight="bold" className="public-track__details-chevron" aria-hidden />
                </summary>
                <div className="public-track__details-content">
                  <div className="public-track__section">
                    <h3 className="public-track__section-title">{t.chiefComplaint}</h3>
                    <p className="public-track__complaint-text">
                      {report.chief_complaint || 'No description provided'}
                    </p>
                  </div>

                  <div className="public-track__section">
                    <h3 className="public-track__section-title">{t.animalDetails}</h3>
                    <div className="public-track__grid">
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.speciesLabel}</span>
                        <span className="public-track__item-value">{speciesText}</span>
                      </div>
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.animalCountLabel}</span>
                        <span className="public-track__item-value"><bdi>{countText}</bdi></span>
                      </div>
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.lifeStageLabel}</span>
                        <span className="public-track__item-value">{lifeStageText}</span>
                      </div>
                      {report.group_breakdown && (
                        <div className="public-track__item">
                          <span className="public-track__item-label">Breakdown</span>
                          <span className="public-track__item-value">{report.group_breakdown}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="public-track__section">
                    <h3 className="public-track__section-title">
                      <MapPin size={16} aria-hidden />
                      <span>{t.rescueLocation}</span>
                    </h3>
                    <div className="public-track__grid">
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.areaLabel}</span>
                        <span className="public-track__item-value">
                          {report.location_area || t.notSpecified}
                        </span>
                      </div>
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.cityLabel}</span>
                        <span className="public-track__item-value">{report.city || t.notSpecified}</span>
                      </div>
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.landmarkLabel}</span>
                        <span className="public-track__item-value">
                          {(!report.location_landmark || report.location_landmark.toLowerCase() === 'none')
                            ? t.landmarkNone
                            : report.location_landmark}
                        </span>
                      </div>
                      {coordinatesText && (
                        <div className="public-track__item">
                          <span className="public-track__item-label">Coordinates</span>
                          <span className="public-track__item-value"><bdi dir="ltr" className="public-track__ltr-text">{coordinatesText}</bdi></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {photos && photos.length > 0 && (
                    <div className="public-track__section">
                      <h3 className="public-track__section-title">{t.casePhotos}</h3>
                      <div className="public-track__photos-gallery">
                        {photos.map((photo: any, idx: number) => {
                          const src =
                            typeof photo === 'string'
                              ? photo
                              : photo?.url ||
                                photo?.data_url ||
                                (photo?.r2_key ? `/api/photos/${photo.r2_key}` : '')
                          if (!src) return null
                          return (
                            <img
                              key={photo.id || idx}
                              src={src}
                              alt={`Case photo ${idx + 1}`}
                              className="public-track__photo-img"
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="public-track__section">
                    <div className="public-track__section-header">
                      <h3 className="public-track__section-title">
                        <ShieldCheck size={16} aria-hidden />
                        <span>{t.reporterDetails}</span>
                      </h3>
                      <span className="public-track__protected-pill">
                        <ShieldCheck size={13} weight="bold" aria-hidden />
                        <span>{t.privacyProtected}</span>
                      </span>
                    </div>
                    <div className="public-track__grid">
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.reporterNameLabel}</span>
                        <span className="public-track__item-value">
                          {(!report.reporter_name || report.reporter_name.toLowerCase() === 'anonymous')
                            ? t.anonymous
                            : report.reporter_name}
                        </span>
                      </div>
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.phoneLabel}</span>
                        <span className="public-track__item-value">
                          {maskedPhone ? (
                            <bdi dir="ltr" className="public-track__ltr-text">{maskedPhone}</bdi>
                          ) : (
                            t.notProvided
                          )}
                        </span>
                      </div>
                      <div className="public-track__item">
                        <span className="public-track__item-label">{t.cnicLabel}</span>
                        <span className="public-track__item-value">
                          {maskedCnic ? (
                            <bdi dir="ltr" className="public-track__ltr-text">{maskedCnic}</bdi>
                          ) : (
                            t.notProvided
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div className="public-track__actions-row">
            <button
              type="button"
              onClick={handleCopyLink}
              className="public-track__btn public-track__btn--secondary"
            >
              {copied ? (
                <>
                  <Check size={18} aria-hidden />
                  <span>{t.copied}</span>
                </>
              ) : (
                <>
                  <Copy size={18} aria-hidden />
                  <span>{t.copyTrackingLink}</span>
                </>
              )}
            </button>
            <Link to="/report" className="public-track__btn public-track__btn--primary">
              {t.reportAnotherCase}
            </Link>
          </div>
        </div>
      </main>
      <SanctuaryFooter />
    </div>
  )
}
