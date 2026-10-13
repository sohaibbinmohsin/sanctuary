import type { RescueReport } from '@/features/reports/domain/rescueReports'
import { Camera, FirstAid, MapPin, Phone, LockKey } from '@phosphor-icons/react'

export type ReportFactsGridProps = {
  report: RescueReport
}

export function ReportFactsGrid({ report }: ReportFactsGridProps) {
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
          <span className="proof-count-pill">No photos</span>
        </div>
        <div className="detail-evidence-gallery">
          <div className="evidence-placeholder-box">
            <span className="evidence-placeholder-text">No proof photos attached to report</span>
          </div>
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
            <span className="fact-value badge-kv emergency">Medical emergency</span>
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
