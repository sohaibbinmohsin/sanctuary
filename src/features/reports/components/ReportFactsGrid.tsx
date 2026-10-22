import { useEffect, useState, useCallback } from 'react'
import { Camera, FirstAid, MapPin, Phone, LockKey, User, Scales, XCircle } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  type RescueReport,
  type ReportPhoto,
  getPhotosForReport,
  formatPhoneNumber,
  formatCnic,
} from '@/features/reports/domain/rescueReports'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'

export type ReportFactsGridProps = {
  report: RescueReport
}

export function ReportFactsGrid({ report }: ReportFactsGridProps) {
  const db = useDb()
  const [photos, setPhotos] = useState<ReportPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

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
              {report.category === 'cruelty' ? 'Animal cruelty' : 'Medical emergency'}
            </span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Species</span>
            <span className="fact-value font-medium">{speciesFormatted}</span>
          </div>
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
              <span className="fact-value font-medium">{report.location_area}</span>
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
            <span className="fact-label">Reporter Name</span>
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
    </div>
  )
}
