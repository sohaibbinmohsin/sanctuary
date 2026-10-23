import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  Check,
  Siren,
  Clock,
  MapPin,
  ShieldCheck,
  ShareNetwork,
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { maskPhoneNumber, maskCnic } from '@/features/reports/domain/privacyMask'
import { useReportTrackSeo } from '@/features/reports/domain/reportSeo'
import '@/features/reports/publicReport.css'

interface PipelineStageDef {
  key: string
  label: string
  timeKey: string
}

const PIPELINE_STAGES: readonly PipelineStageDef[] = [
  { key: 'logged', label: 'Logged', timeKey: 'stage_logged_at' },
  { key: 'accepted', label: 'Accepted', timeKey: 'stage_accepted_at' },
  { key: 'dispatched', label: 'Dispatched', timeKey: 'stage_dispatched_at' },
  { key: 'attended', label: 'Attended', timeKey: 'stage_attended_at' },
  { key: 'resolved', label: 'Resolved', timeKey: 'stage_resolved_at' },
] as const

const STAGE_ORDER: Record<string, number> = {
  logged: 0,
  accepted: 1,
  dispatched: 2,
  attended: 3,
  resolved: 4,
}

function getStatusBanner(status?: string | null): string {
  const s = (status || '').toLowerCase()
  switch (s) {
    case 'logged':
      return 'Report received by the rescue network. Responders are reviewing the details.'
    case 'accepted':
      return 'Report accepted by responders. Field team is preparing for dispatch.'
    case 'dispatched':
      return "Rescue unit has been dispatched to the animal's location."
    case 'attended':
      return 'Responders are currently on scene attending to the animal.'
    case 'resolved':
      return 'Rescue completed. Case has been resolved.'
    default:
      return 'Case update in progress.'
  }
}

function getStatusBadgeText(status?: string | null): string {
  if (!status) return 'Logged'
  const s = status.toLowerCase()
  if (s === 'logged') return 'Logged'
  if (s === 'accepted') return 'Accepted'
  if (s === 'dispatched') return 'Dispatched'
  if (s === 'attended') return 'Attended'
  if (s === 'resolved') return 'Resolved'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatStageTime(isoString?: string | null): string | null {
  if (!isoString) return null
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return null
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

function getStageTimestamp(
  stage: PipelineStageDef,
  report: Record<string, any>,
  isResolved: boolean
): string | null {
  let val = report[stage.timeKey]
  if (!val && stage.key === 'logged') {
    val = report.created_at
  }
  if (!val && stage.key === 'resolved' && isResolved) {
    val = report.updated_at
  }
  return formatStageTime(val)
}

export function PublicReportTrackScreen() {
  const { reportNumber } = useParams<{ reportNumber: string }>()
  const db = useDb()
  const [report, setReport] = useState<Record<string, any> | null>(null)
  useReportTrackSeo(reportNumber, report?.status)
  const [photos, setPhotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const loadedKeyRef = useRef<string | null>(null)

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

      // 1. Try DB first
      if (db) {
        try {
          if (typeof db.getOptional === 'function') {
            fetchedReport = await db.getOptional(
              'SELECT * FROM rescue_reports WHERE report_number = ?',
              [reportNumber]
            )
          } else if (typeof db.getAll === 'function') {
            const rows = await db.getAll(
              'SELECT * FROM rescue_reports WHERE report_number = ?',
              [reportNumber]
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
                    (item.report_number === reportNumber || item.reportNumber === reportNumber)
                ) || null
            } else if (parsed && typeof parsed === 'object') {
              fetchedReport = parsed[reportNumber] || null
            }
          }
        } catch {
          // Ignore json parse error
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
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Clipboard write fallback
    }
  }

  if (loading) {
    return (
      <div className="public-report">
        <header className="public-report__header">
          <Link to="/" className="public-report__brand" aria-label="Sanctuary Home">
            <img src="/sanctuary-logo.svg" alt="" width={36} height={36} />
            <span>Sanctuary</span>
          </Link>
          <div className="public-report__emergency-pill">
            <Siren size={16} weight="bold" aria-hidden />
            <span>Live Case Tracker</span>
          </div>
        </header>
        <main className="public-report__main">
          <div
            className="public-report__card"
            style={{ textAlign: 'center', padding: 'var(--space-8)' }}
          >
            <p style={{ color: 'var(--color-ink-muted)', margin: 0 }}>
              Loading case details...
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="public-report">
        <header className="public-report__header">
          <Link to="/" className="public-report__brand" aria-label="Sanctuary Home">
            <img src="/sanctuary-logo.svg" alt="" width={36} height={36} />
            <span>Sanctuary</span>
          </Link>
          <div className="public-report__emergency-pill">
            <Siren size={16} weight="bold" aria-hidden />
            <span>Live Case Tracker</span>
          </div>
        </header>
        <main className="public-report__main">
          <div className="public-report__card">
            <div className="public-track__not-found">
              <Siren size={40} className="public-track__not-found-icon" aria-hidden />
              <h2 className="public-track__not-found-title">Case not found</h2>
              <p className="public-track__not-found-desc">
                We could not find a rescue report matching this reference number. It may still be syncing or the tracking link could be incorrect.
              </p>
              <div
                className="public-track__actions-row"
                style={{ borderTop: 'none', justifyContent: 'center' }}
              >
                <Link to="/report" className="public-track__btn public-track__btn--primary">
                  <ArrowLeft size={16} aria-hidden />
                  <span>Report an emergency</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const normalizedStatus = (report.status || 'logged').toLowerCase()
  const isResolved =
    normalizedStatus === 'resolved' ||
    normalizedStatus === 'completed' ||
    normalizedStatus === 'admitted_shelter' ||
    normalizedStatus === 'spot_released'
  const activeStageIndex = isResolved ? 4 : (STAGE_ORDER[normalizedStatus] ?? 0)

  const statusBadgeText = getStatusBadgeText(report.status)
  const statusBannerText = getStatusBanner(report.status)
  const maskedPhone = maskPhoneNumber(report.reporter_phone)
  const maskedCnic = maskCnic(report.reporter_cnic)
  const animalCount = Number(report.animal_count) || 1
  const countText = `${animalCount} animal${animalCount === 1 ? '' : 's'}`
  const lifeStageText = report.life_stage
    ? report.life_stage.charAt(0).toUpperCase() + report.life_stage.slice(1)
    : 'Not specified'

  const coordinatesText =
    typeof report.latitude === 'number' && typeof report.longitude === 'number'
      ? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
      : null

  return (
    <div className="public-report">
      <header className="public-report__header">
        <Link to="/" className="public-report__brand" aria-label="Sanctuary Home">
          <img src="/sanctuary-logo.svg" alt="" width={36} height={36} />
          <span>Sanctuary</span>
        </Link>
        <div className="public-report__emergency-pill">
          <Siren size={16} weight="bold" aria-hidden />
          <span>Live Case Tracker</span>
        </div>
      </header>

      <main className="public-report__main">
        <div className="public-report__card">
          <div className="public-track">
            <div className="public-track__nav-back">
              <Link to="/report" className="public-track__back-link">
                <ArrowLeft size={14} aria-hidden />
                <span>Submit another report</span>
              </Link>
              <span className="public-track__share-hint">
                <ShareNetwork size={14} aria-hidden />
                <span>Public Tracking</span>
              </span>
            </div>

            <div className="public-track__header-row">
              <span className="public-track__case-pill">
                Case #{report.report_number}
              </span>
              <span
                className={`public-track__status-badge public-track__status-badge--${normalizedStatus}`}
              >
                {statusBadgeText}
              </span>
            </div>

            <div className="public-track__banner">
              <Clock size={20} weight="bold" className="public-track__banner-icon" aria-hidden />
              <span>{statusBannerText}</span>
            </div>

            <div className="public-track__pipeline">
              <ol className="public-track__pipeline-list">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isCompleted = isResolved ? true : idx < activeStageIndex
                  const isActive = !isResolved && idx === activeStageIndex
                  const time = getStageTimestamp(stage, report, isResolved)

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
                          <Check size={14} weight="bold" aria-label={`Completed: ${stage.label}`} />
                        ) : isActive ? (
                          <Clock size={14} weight="bold" aria-label={`Active: ${stage.label}`} />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <span className="public-track__step-label">{stage.label}</span>
                      {time && <span className="public-track__step-time">{time}</span>}
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className="public-track__section">
              <h3 className="public-track__section-title">Chief Complaint</h3>
              <p className="public-track__complaint-text">
                {report.chief_complaint || 'No description provided'}
              </p>
            </div>

            <div className="public-track__section">
              <h3 className="public-track__section-title">Animal Details</h3>
              <div className="public-track__grid">
                <div className="public-track__item">
                  <span className="public-track__item-label">Species</span>
                  <span className="public-track__item-value">{report.species || 'Animal'}</span>
                </div>
                <div className="public-track__item">
                  <span className="public-track__item-label">Animal count</span>
                  <span className="public-track__item-value">{countText}</span>
                </div>
                <div className="public-track__item">
                  <span className="public-track__item-label">Life stage</span>
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
                <span>Rescue Location</span>
              </h3>
              <div className="public-track__grid">
                <div className="public-track__item">
                  <span className="public-track__item-label">Area</span>
                  <span className="public-track__item-value">
                    {report.location_area || 'Not specified'}
                  </span>
                </div>
                <div className="public-track__item">
                  <span className="public-track__item-label">City</span>
                  <span className="public-track__item-value">{report.city || 'Not specified'}</span>
                </div>
                <div className="public-track__item">
                  <span className="public-track__item-label">Landmark</span>
                  <span className="public-track__item-value">
                    {report.location_landmark || 'None'}
                  </span>
                </div>
                {coordinatesText && (
                  <div className="public-track__item">
                    <span className="public-track__item-label">Coordinates</span>
                    <span className="public-track__item-value">{coordinatesText}</span>
                  </div>
                )}
              </div>
            </div>

            {photos && photos.length > 0 && (
              <div className="public-track__section">
                <h3 className="public-track__section-title">Case Photos</h3>
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
              <h3 className="public-track__section-title">
                <ShieldCheck size={16} aria-hidden />
                <span>Reporter & Privacy</span>
              </h3>
              <div className="public-track__grid">
                <div className="public-track__item">
                  <span className="public-track__item-label">Reporter name</span>
                  <span className="public-track__item-value">
                    {report.reporter_name || 'Anonymous'}
                  </span>
                </div>
                <div className="public-track__item">
                  <span className="public-track__item-label">Phone number</span>
                  <span className="public-track__item-value">
                    {maskedPhone || 'Not provided'}
                  </span>
                </div>
                <div className="public-track__item">
                  <span className="public-track__item-label">CNIC number</span>
                  <span className="public-track__item-value">
                    {maskedCnic || 'Not provided'}
                  </span>
                </div>
              </div>
              <div className="public-track__privacy-card">
                <ShieldCheck size={20} className="public-track__privacy-icon" aria-hidden />
                <p className="public-track__privacy-text">
                  Reporter contact details are privacy-protected. Only authorized sanctuary dispatchers can access full contact information.
                </p>
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
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} aria-hidden />
                    <span>Copy tracking link</span>
                  </>
                )}
              </button>
              <Link to="/report" className="public-track__btn public-track__btn--primary">
                Report another case
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
