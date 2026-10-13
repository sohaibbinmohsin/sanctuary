import { useNavigate } from 'react-router-dom'
import type { RescueReport } from '@/features/reports/domain/rescueReports'

export type ReportTimelineCardProps = {
  report: RescueReport
}

function formatCardTime(isoString?: string | null): { timeStr: string; relStr: string } {
  if (!isoString) {
    return { timeStr: '--:--', relStr: '' }
  }
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) {
    return { timeStr: '--:--', relStr: '' }
  }

  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const timeStr = `${hours}:${minutes}`

  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / (60 * 1000)))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  let relStr = 'Just now'
  if (diffMinutes < 1) {
    relStr = 'Just now'
  } else if (diffMinutes < 60) {
    relStr = `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    relStr = `${diffHours}h ago`
  } else {
    relStr = `${diffDays}d ago`
  }

  return { timeStr, relStr }
}

function getStatusBadgeInfo(status?: string | null, dispositionType?: string | null): { label: string; className: string } {
  if (!status || status === 'logged') {
    return { label: 'New Report', className: 'status-badge-clean new' }
  }
  if (status === 'accepted') {
    return { label: 'Accepted', className: 'status-badge-clean accepted' }
  }
  if (status === 'dispatched') {
    return { label: 'Dispatched', className: 'status-badge-clean active' }
  }
  if (status === 'attended') {
    if (dispositionType === 'transferred_partner') {
      return { label: 'At Partner Vet', className: 'status-badge-clean vet' }
    }
    if (dispositionType === 'admitted_shelter') {
      return { label: 'In Shelter', className: 'status-badge-clean shelter' }
    }
    if (dispositionType === 'spot_released') {
      return { label: 'Spot Released', className: 'status-badge-clean shelter' }
    }
    return { label: 'Attended', className: 'status-badge-clean shelter' }
  }
  if (status === 'cancelled') {
    return { label: 'Cancelled', className: 'status-badge-clean declined' }
  }
  return { label: status, className: 'status-badge-clean' }
}

export function ReportTimelineCard({ report }: ReportTimelineCardProps) {
  const navigate = useNavigate()
  const { timeStr, relStr } = formatCardTime(report.created_at)
  const statusInfo = getStatusBadgeInfo(report.status, report.disposition_type)
  const speciesDisplay = report.species ? report.species.toUpperCase() : 'OTHER'

  return (
    <div className="timeline-item-row">
      <div className="timeline-item-time">
        <span className="timeline-time-val">{timeStr}</span>
        <span className="timeline-time-rel">{relStr}</span>
      </div>
      <div
        className="report-card-clickable"
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/reports/${report.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(`/reports/${report.id}`)
          }
        }}
      >
        <div className="report-card__left">
          <div className="report-card__id-row">
            <span className="report-card__id-title">{report.report_number}</span>
            <span className="case-species-tag">{speciesDisplay}</span>
          </div>
          <div className="report-card__complaint" title={report.chief_complaint ?? undefined}>
            {report.chief_complaint}
          </div>
        </div>
        <div className="report-card__status-wrap">
          <span className={statusInfo.className}>{statusInfo.label}</span>
        </div>
      </div>
    </div>
  )
}
