import { useNavigate } from 'react-router-dom'
import { saveReportsScrollPosition } from '@/shared/lib/scroll'
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

  if (diffMs < 0) {
    return { timeStr, relStr: '' }
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  let relStr = 'Just now'
  if (diffMinutes < 1) {
    relStr = 'Just now'
  } else if (diffMinutes < 60) {
    relStr = `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    relStr = `${diffHours}h ago`
  } else if (diffDays < 30) {
    relStr = `${diffDays}d ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    relStr = `${months}mo ago`
  } else {
    const years = Math.floor(diffDays / 365)
    relStr = `${years}y ago`
  }

  return { timeStr, relStr }
}

function getStatusBadgeInfo(
  status?: string | null,
  dispositionType?: string | null,
  transportType?: string | null,
  category?: string | null,
): { label: string; className: string } {
  const isCruelty = category === 'cruelty'
  if (!status || status === 'logged') {
    return {
      label: isCruelty ? 'New Complaint' : 'New Report',
      className: 'status-badge-clean new',
    }
  }
  if (status === 'accepted') {
    return {
      label: isCruelty ? 'Investigating' : 'Accepted',
      className: 'status-badge-clean accepted',
    }
  }
  if (status === 'dispatched') {
    return {
      label: isCruelty
        ? 'Legal / Notice'
        : transportType === 'reporter'
          ? 'Dispatched (Reporter)'
          : 'Dispatched',
      className: 'status-badge-clean active',
    }
  }
  if (status === 'attended') {
    if (dispositionType === 'transferred_partner') {
      return { label: 'At Partner Vet', className: 'status-badge-clean vet' }
    }
    if (dispositionType === 'admitted_shelter') {
      return {
        label: isCruelty ? 'In Custody' : 'In Shelter',
        className: 'status-badge-clean shelter',
      }
    }
    if (dispositionType === 'spot_released') {
      return {
        label: isCruelty ? 'Resolved On-Site' : 'Spot Released',
        className: 'status-badge-clean shelter',
      }
    }
    return {
      label: isCruelty ? 'In Custody' : 'Attended',
      className: 'status-badge-clean shelter',
    }
  }
  if (status === 'cancelled') {
    return {
      label: isCruelty ? 'Dismissed' : 'Cancelled',
      className: 'status-badge-clean declined',
    }
  }
  return { label: status, className: 'status-badge-clean' }
}

export function ReportTimelineCard({ report }: ReportTimelineCardProps) {
  const navigate = useNavigate()
  const { timeStr, relStr } = formatCardTime(report.created_at)
  const statusInfo = getStatusBadgeInfo(
    report.status,
    report.disposition_type,
    report.transport_type,
    report.category,
  )
  const speciesDisplay = report.species ? report.species.toUpperCase() : 'OTHER'

  return (
    <div className="timeline-item-row" id={`report-card-${report.id}`}>
      <div className="timeline-item-time">
        <span className="timeline-time-val">{timeStr}</span>
        <span className="timeline-time-rel">{relStr}</span>
      </div>
      <div
        className="report-card-clickable"
        role="button"
        tabIndex={0}
        onClick={() => {
          saveReportsScrollPosition(report.id)
          navigate(`/reports/${report.id}`)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            saveReportsScrollPosition(report.id)
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
