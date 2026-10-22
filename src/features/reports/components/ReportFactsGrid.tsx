import { useEffect, useState, useCallback, useRef } from 'react'
import { Camera, FirstAid, MapPin, Phone, LockKey, Plus } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  type RescueReport,
  type ReportPhoto,
  getPhotosForReport,
  addReportPhoto,
} from '@/features/reports/domain/rescueReports'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'

export type ReportFactsGridProps = {
  report: RescueReport
  onPhotoAdded?: () => void
}

export function ReportFactsGrid({ report, onPhotoAdded }: ReportFactsGridProps) {
  const db = useDb()
  const { member } = useCurrentMember()
  const [photos, setPhotos] = useState<ReportPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!db || !files || files.length === 0) return
    const orgId = report.org_id || member?.orgId
    if (!orgId) return

    setUploading(true)
    try {
      const now = new Date().toISOString()
      for (const file of Array.from(files)) {
        await addReportPhoto(db, {
          orgId,
          reportId: report.id,
          blob: file,
        })
        if (report.animal_id) {
          try {
            await db.execute(
              `INSERT INTO photos (id, org_id, animal_id, r2_key, local_only, upload_state, capture_source, verified, created_at)
               VALUES (?, ?, ?, NULL, 1, 'pending', 'upload', 0, ?)`,
              [crypto.randomUUID(), orgId, report.animal_id, now],
            )
          } catch (syncErr) {
            console.warn('Could not mirror photo to animal profile', syncErr)
          }
        }
      }
      await loadPhotos()
      onPhotoAdded?.()
    } catch (err) {
      console.error('Failed to upload report photo', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const speciesFormatted = report.species
    ? report.species.charAt(0).toUpperCase() + report.species.slice(1).toLowerCase()
    : 'Unknown'

  return (
    <div className="report-facts-grid">
      {/* 1. Photos & Proof Card */}
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="detail-card__heading">
            <Camera weight="bold" size={18} aria-hidden />
            <span>Photos &amp; Proof</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="proof-count-pill">
              {photos.length === 0
                ? 'No photos'
                : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
            </span>
            {report.status !== 'cancelled' && (
              <button
                type="button"
                className="btn btn--secondary btn--sm pressable"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Add photos to report"
                aria-label="Add photos"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  fontSize: '12.5px',
                  height: '32px',
                  minHeight: '32px',
                }}
              >
                <Plus size={14} weight="bold" />
                <span>{uploading ? 'Adding…' : 'Photo'}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <div className="detail-evidence-gallery">
          {photos.length === 0 ? (
            <div
              className="evidence-placeholder-box pressable"
              onClick={() => {
                if (report.status !== 'cancelled') fileInputRef.current?.click()
              }}
              style={{ cursor: report.status !== 'cancelled' ? 'pointer' : 'default' }}
            >
              {report.status !== 'cancelled' ? (
                <>
                  <Plus size={18} weight="bold" style={{ marginBottom: '4px', color: 'var(--color-ink-muted)' }} />
                  <span className="evidence-placeholder-text">Click or tap to attach proof photos</span>
                </>
              ) : (
                <span className="evidence-placeholder-text">No proof photos attached to report</span>
              )}
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
              {report.status !== 'cancelled' && (
                <button
                  type="button"
                  className="pressable"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Add more photos"
                  aria-label="Add more photos"
                  style={{
                    width: '5.5rem',
                    height: '5.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px dashed var(--color-border)',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  <Plus size={20} weight="bold" />
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Add</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Condition & Animal Card */}
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="detail-card__heading">
            <FirstAid weight="bold" size={18} aria-hidden />
            <span>Condition &amp; Animal</span>
          </div>
        </div>
        <div className="facts-kv-list">
          <div className="fact-row">
            <span className="fact-label">Category</span>
            <span className={`fact-value badge-kv ${report.category === 'cruelty' ? 'cruelty' : 'emergency'}`}>
              {report.category === 'cruelty'
                ? 'Animal cruelty'
                : report.category === 'welfare'
                  ? 'Welfare check'
                  : 'Medical emergency'}
            </span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Species</span>
            <span className="fact-value font-medium">{speciesFormatted}</span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Chief Complaint</span>
            <span className="fact-value font-medium">{report.chief_complaint}</span>
          </div>
        </div>
      </div>

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
            <span className="fact-value font-medium">{report.location_area}</span>
          </div>
          {report.location_landmark ? (
            <div className="fact-row highlight-row">
              <span className="fact-label">Landmark</span>
              <span className="fact-value landmark-highlight">{report.location_landmark}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 4. Reporter Information Card (Confidential / Internal) */}
      <div className="detail-card">
        <div className="detail-card__header">
          <div className="detail-card__heading">
            <LockKey weight="bold" size={18} aria-hidden />
            <span>Reporter Information</span>
          </div>
          <span className="privacy-status-pill">
            <LockKey size={12} weight="bold" aria-hidden />
            <span>Confidential / Internal</span>
          </span>
        </div>
        <div className="facts-kv-list">
          {report.reporter_name ? (
            <div className="fact-row">
              <span className="fact-label">Reporter Name</span>
              <span className="fact-value font-medium">{report.reporter_name}</span>
            </div>
          ) : null}
          {report.reporter_phone ? (
            <div className="fact-row">
              <span className="fact-label">Phone</span>
              <div className="caller-contact-actions">
                <span className="fact-value font-mono font-semibold">{report.reporter_phone}</span>
                <a
                  href={`tel:${report.reporter_phone}`}
                  className="quick-call-mini-btn"
                  title={`Call ${report.reporter_phone}`}
                >
                  <Phone size={13} weight="bold" aria-hidden />
                  <span>Call</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="fact-row">
              <span className="fact-label">Phone</span>
              <span className="fact-value font-muted">No phone provided</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
