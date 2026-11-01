import { useEffect, useState, useCallback, useMemo } from 'react'
import { Camera, FirstAid, MapPin, Phone, LockKey, User, Scales, XCircle, Compass, Copy, Check, ArrowsOutSimple, X } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  type RescueReport,
  type ReportPhoto,
  getPhotosForReport,
  formatPhoneNumber,
  formatCnic,
  formatCoordinates,
  getNavigationUrl,
  isCentroidCoordinates,
} from '@/features/reports/domain/rescueReports'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'
import { ReportLocationMap } from './ReportLocationMap'

export type ReportFactsGridProps = {
  report: RescueReport
}

export function ReportFactsGrid({ report }: ReportFactsGridProps) {
  const db = useDb()
  const [photos, setPhotos] = useState<ReportPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [coordsCopied, setCoordsCopied] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const isCentroid = useMemo(() => {
    return isCentroidCoordinates(
      report.latitude,
      report.longitude,
      report.location_area,
      report.city,
    )
  }, [report.latitude, report.longitude, report.location_area, report.city])

  useEffect(() => {
    if (!isLightboxOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLightboxOpen])

  const handleCopyCoordinates = useCallback(() => {
    if (report.latitude == null || report.longitude == null) return
    const text = `${report.latitude}, ${report.longitude}`
    navigator.clipboard?.writeText(text).then(() => {
      setCoordsCopied(true)
      setTimeout(() => setCoordsCopied(false), 2000)
    }).catch(() => {
      // fallback
    })
  }, [report.latitude, report.longitude])

  const loadPhotos = useCallback(async () => {
    if (!db || !report.id) return
    try {
      const items = await getPhotosForReport(db, report.id)
      setPhotos(items)
      const urls: Record<string, string> = {}
      for (const p of items) {
        const blob = await getLocalPhoto(p.id)
        if (blob) {
          urls[p.id] = URL.createObjectURL(blob)
        } else if (p.r2_key) {
          const pubUrl = publicPhotoUrl(p.r2_key)
          if (pubUrl) {
            urls[p.id] = pubUrl
          }
        }
      }
      setPhotoUrls(urls)
    } catch (err) {
      console.error('Failed to load report photos', err)
    }
  }, [db, report.id])

  useEffect(() => {
    void loadPhotos()
  }, [loadPhotos])

  const speciesFormatted = report.species
    ? report.species.charAt(0).toUpperCase() + report.species.slice(1).toLowerCase()
    : 'Unknown'

  const formattedPhone = report.reporter_phone ? formatPhoneNumber(report.reporter_phone) : null
  const telHref = report.reporter_phone ? `tel:${report.reporter_phone}` : '#'

  return (
    <div className="report-facts-grid">
      {/* 1. Photos & Proof Card */}
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="detail-card__heading">
            <Camera weight="bold" size={18} aria-hidden />
            <span>Photos &amp; Proof</span>
          </div>
          <span className="proof-count-pill">
            {photos.length === 0
              ? 'No photos'
              : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="detail-evidence-gallery">
          {photos.length === 0 ? (
            <div className="evidence-placeholder-box">
              <span className="evidence-placeholder-text">No proof photos attached to report</span>
            </div>
          ) : (
            <div
              className="evidence-thumbnails-grid"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.625rem',
                marginTop: '0.5rem',
              }}
            >
              {photos.map((p) => {
                const url = photoUrls[p.id]
                return (
                  <div
                    key={p.id}
                    style={{
                      width: '5.5rem',
                      height: '5.5rem',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt="Proof thumbnail"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Condition & Animal Card */}
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="detail-card__heading">
            {report.category === 'cruelty' ? (
              <Scales weight="bold" size={18} aria-hidden />
            ) : (
              <FirstAid weight="bold" size={18} aria-hidden />
            )}
            <span>
              {report.category === 'cruelty' ? 'Incident & Animal' : 'Condition & Animal'}
            </span>
          </div>
        </div>
        <div className="facts-kv-list">
          <div className="fact-row">
            <span className="fact-label">Category</span>
            <span className={`fact-value badge-kv ${report.category === 'cruelty' ? 'cruelty' : 'emergency'}`}>
              {report.category === 'cruelty' ? 'Animal cruelty' : 'Injured/sick animal'}
            </span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Species &amp; Stage</span>
            <span className="fact-value font-medium">
              {speciesFormatted}
              {report.life_stage ? ` · ${report.life_stage === 'child' ? 'Child' : 'Adult'}` : ''}
            </span>
          </div>
          {report.animal_count && report.animal_count > 1 ? (
            <div className="fact-row">
              <span className="fact-label">Animal Count</span>
              <span className="fact-value font-medium" style={{ color: 'var(--color-brand, #de6b2b)' }}>
                {report.animal_count} animals (litter / group)
              </span>
            </div>
          ) : null}
          {report.group_breakdown ? (() => {
            try {
              const parsed = JSON.parse(report.group_breakdown)
              if (Array.isArray(parsed) && parsed.length > 0) {
                const summary = parsed
                  .map((p: any) => {
                    const count = p.count || 1
                    const stage = p.lifeStage ? (p.lifeStage === 'adult' ? 'Adult' : 'Child') : ''
                    const sp = p.species ? p.species.charAt(0).toUpperCase() + p.species.slice(1) : ''
                    return [count, stage, sp].filter(Boolean).join(' ')
                  })
                  .join(' · ')
                return (
                  <div className="fact-row">
                    <span className="fact-label">Group Roster</span>
                    <span className="fact-value font-medium" style={{ color: 'var(--color-brand, #de6b2b)' }}>
                      {summary}
                    </span>
                  </div>
                )
              }
            } catch {}
            return null
          })() : null}
          {report.disposition_type === 'deceased_doa' ? (
            <div className="fact-row">
              <span className="fact-label">Disposition</span>
              <span className="fact-value" style={{ color: 'var(--color-danger, #b91c1c)', fontWeight: 600 }}>
                Dead on Arrival (DOA)
              </span>
            </div>
          ) : null}
          <div className="fact-row">
            <span className="fact-label">
              {report.category === 'cruelty' ? 'Incident / Complaint' : 'Chief Complaint'}
            </span>
            <span className="fact-value font-medium">{report.chief_complaint}</span>
          </div>
        </div>
      </div>

      {/* Legal Action & Notice Card */}
      {report.legal_notes && (
        <div className="detail-card">
          <div className="detail-card__header">
            <div className="detail-card__heading">
              <Scales weight="bold" size={18} aria-hidden />
              <span>Legal Action &amp; Notice</span>
            </div>
          </div>
          <div className="facts-kv-list" style={{ padding: '0.5rem 0 0.25rem 0' }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.9375rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                color: 'var(--color-text-main)',
              }}
            >
              {report.legal_notes}
            </p>
          </div>
        </div>
      )}

      {/* Dismissal / Cancellation Reason Card */}
      {report.dismissal_reason && (
        <div className="detail-card" style={{ borderColor: 'var(--color-danger-border, #fca5a5)' }}>
          <div className="detail-card__header">
            <div className="detail-card__heading" style={{ color: 'var(--color-danger, #b91c1c)' }}>
              <XCircle weight="bold" size={18} aria-hidden />
              <span>
                {report.category === 'cruelty' ? 'Dismissal Reason' : 'Cancellation Reason'}
              </span>
            </div>
          </div>
          <div className="facts-kv-list" style={{ padding: '0.5rem 0 0.25rem 0' }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.9375rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                color: 'var(--color-text-main)',
              }}
            >
              {report.dismissal_reason}
            </p>
          </div>
        </div>
      )}

      {/* 3. Location & Landmark Card */}
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="detail-card__heading">
            <MapPin weight="bold" size={18} aria-hidden />
            <span>Location &amp; Landmark</span>
          </div>
        </div>
        <div className="facts-kv-list">
          <div className="fact-row">
            <span className="fact-label">Area / Location</span>
            {report.location_area ? (
              <span className="fact-value font-medium">
                {report.location_area}
                {report.city ? `, ${report.city}` : ''}
              </span>
            ) : (
              <span className="fact-value font-muted">No location provided</span>
            )}
          </div>
          <div className="fact-row">
            <span className="fact-label">Landmark</span>
            {report.location_landmark ? (
              <span className="fact-value landmark-highlight">{report.location_landmark}</span>
            ) : (
              <span className="fact-value font-muted">No landmark provided</span>
            )}
          </div>
          <div className="fact-row fact-row--coordinates">
            <span className="fact-label">Coordinates</span>
            {report.latitude != null && report.longitude != null ? (
              <div className="location-coordinates-wrap">
                <div className="location-coordinates-header">
                  <div className="location-coordinates-text-group">
                    <span className="fact-value font-mono font-medium">
                      {formatCoordinates(report.latitude, report.longitude)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCoordinates}
                      className="coord-copy-btn pressable"
                      title={coordsCopied ? 'Copied to clipboard!' : 'Copy raw coordinates'}
                      aria-label="Copy coordinates"
                    >
                      {coordsCopied ? (
                        <Check size={14} weight="bold" color="var(--color-forest, #2d6a4f)" />
                      ) : (
                        <Copy size={14} weight="bold" />
                      )}
                    </button>
                    {coordsCopied && (
                      <span className="coord-copied-badge">Copied!</span>
                    )}
                    {isCentroid && (
                      <span className="map-centroid-tag" title="Coordinates represent the neighborhood area centroid">
                        Area Centroid
                      </span>
                    )}
                  </div>

                  <a
                    href={getNavigationUrl(report.latitude, report.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-call-mini-btn"
                    title="Open in Maps for turn-by-turn navigation"
                  >
                    <Compass size={13} weight="bold" aria-hidden />
                    <span>Navigate</span>
                  </a>
                </div>

                <div
                  className="location-map-container pressable"
                  onClick={() => setIsLightboxOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setIsLightboxOpen(true)
                    }
                  }}
                  title="Click to view enlarged map"
                >
                  <ReportLocationMap
                    latitude={report.latitude}
                    longitude={report.longitude}
                    landmark={report.location_landmark}
                    areaName={report.location_area}
                    isCentroid={isCentroid}
                    onMapClick={() => setIsLightboxOpen(true)}
                  />
                  <div className="location-map-expand-badge">
                    <ArrowsOutSimple size={12} weight="bold" aria-hidden />
                    <span>Tap to enlarge</span>
                  </div>
                </div>
              </div>
            ) : (
              <span className="fact-value font-muted">No coordinates pinned</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Reporter Information Card (Confidential) */}
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="detail-card__heading">
            <User weight="bold" size={18} aria-hidden />
            <span>Reporter Information</span>
          </div>
          <span className="privacy-status-pill">
            <LockKey size={12} weight="bold" aria-hidden />
            <span>Confidential</span>
          </span>
        </div>
        <div className="facts-kv-list">
          <div className="fact-row">
            <span className="fact-label">Intake Source</span>
            <span className="fact-value font-medium">
              {report.intake_source === 'rescue_1122'
                ? 'Rescue 1122'
                : report.intake_source === 'field_patrol'
                  ? 'Field Patrol (Self)'
                  : report.intake_source === 'partner_transfer'
                    ? 'Partner Transfer'
                    : 'Citizen Call'}
            </span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Name</span>
            {report.reporter_name ? (
              <span className="fact-value font-medium">{report.reporter_name}</span>
            ) : (
              <span className="fact-value font-muted">No name provided</span>
            )}
          </div>
          <div className="fact-row">
            <span className="fact-label">Phone</span>
            {report.reporter_phone ? (
              <div className="caller-contact-actions">
                <span className="fact-value font-mono font-semibold">{formattedPhone}</span>
                <a
                  href={telHref}
                  className="quick-call-mini-btn"
                  title={`Call ${formattedPhone}`}
                >
                  <Phone size={13} weight="bold" aria-hidden />
                  <span>Call</span>
                </a>
              </div>
            ) : (
              <span className="fact-value font-muted">No phone provided</span>
            )}
          </div>
          <div className="fact-row">
            <span className="fact-label">CNIC</span>
            {report.reporter_cnic ? (
              <span className="fact-value font-mono font-medium">
                {formatCnic(report.reporter_cnic)}
              </span>
            ) : (
              <span className="fact-value font-muted">No CNIC provided</span>
            )}
          </div>
        </div>
      </div>

      {/* Map Lightbox UI */}
      {isLightboxOpen && report.latitude != null && report.longitude != null && (
        <div
          className="map-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged rescue location map"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="map-lightbox-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="map-lightbox-header">
              <div className="map-lightbox-title-group">
                <div className="map-lightbox-title">
                  <MapPin size={18} weight="fill" color="#e03131" />
                  <span>
                    {report.location_area || report.location_landmark || 'Rescue Location'}
                    {report.city ? `, ${report.city}` : ''}
                  </span>
                </div>
                {isCentroid && (
                  <span className="map-centroid-tag">
                    Area Centroid (~650m zone)
                  </span>
                )}
              </div>

              <div className="map-lightbox-actions">
                <button
                  type="button"
                  onClick={handleCopyCoordinates}
                  className="quick-call-mini-btn"
                  title="Copy raw coordinates"
                >
                  {coordsCopied ? (
                    <Check size={14} weight="bold" color="var(--color-forest, #2d6a4f)" />
                  ) : (
                    <Copy size={14} weight="bold" />
                  )}
                  <span>{coordsCopied ? 'Copied' : formatCoordinates(report.latitude, report.longitude)}</span>
                </button>

                <a
                  href={getNavigationUrl(report.latitude, report.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="quick-call-mini-btn"
                  title="Open in Maps for turn-by-turn navigation"
                >
                  <Compass size={14} weight="bold" />
                  <span>Navigate</span>
                </a>

                <button
                  type="button"
                  className="map-lightbox-close"
                  aria-label="Close enlarged map"
                  onClick={() => setIsLightboxOpen(false)}
                >
                  <X size={18} weight="bold" />
                </button>
              </div>
            </div>

            <div className="map-lightbox-body">
              <ReportLocationMap
                latitude={report.latitude}
                longitude={report.longitude}
                landmark={report.location_landmark}
                areaName={report.location_area}
                isCentroid={isCentroid}
                interactive
                className="map-lightbox-canvas"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
