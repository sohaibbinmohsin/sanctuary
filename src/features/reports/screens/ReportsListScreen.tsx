import { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { Button } from '@/shared/ui/Button'
import {
  getRescueReports,
  type RescueReport,
  type RescueReportFilter,
} from '@/features/reports/domain/rescueReports'
import { ReportTimelineCard } from '@/features/reports/components/ReportTimelineCard'
import { LogReportModal } from '@/features/reports/components/LogReportModal'
import { localDateString } from '@/shared/lib/checklist/missedStreak'
import '@/features/reports/reports.css'

type FilterKey = 'all' | 'new' | 'in_progress' | 'completed'

const FILTER_CONFIG: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New reports' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
]

function getDayHeaderLabel(dateStr: string, todayStr: string, yesterdayStr: string): string {
  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr

  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ReportsListScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [reports, setReports] = useState<RescueReport[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const orgId = member?.orgId ?? ''
  const orgInitials = member?.orgInitials ?? 'SANCTUARY'

  const fetchReports = useCallback(async () => {
    if (!db || !orgId) return
    setLoading(true)
    try {
      const data = await getRescueReports(db, orgId, activeFilter as RescueReportFilter)
      setReports(data)
    } catch (err) {
      console.error('Failed to load rescue reports', err)
    } finally {
      setLoading(false)
    }
  }, [db, orgId, activeFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Compute date strings for grouping
  const { todayStr, yesterdayStr } = useMemo(() => {
    const now = new Date()
    const today = localDateString(now)
    const yesterdayDate = new Date(now)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = localDateString(yesterdayDate)
    return { todayStr: today, yesterdayStr: yesterday }
  }, [])

  // Group reports chronologically by day
  const groupedReports = useMemo(() => {
    const groups: { dateStr: string; label: string; reports: RescueReport[] }[] = []
    const groupMap = new Map<string, RescueReport[]>()

    for (const report of reports) {
      const d = report.created_at ? new Date(report.created_at) : null
      const dayKey = d && !Number.isNaN(d.getTime()) ? localDateString(d) : 'Unknown'
      if (!groupMap.has(dayKey)) {
        groupMap.set(dayKey, [])
      }
      groupMap.get(dayKey)!.push(report)
    }

    for (const [dateStr, dayReports] of groupMap.entries()) {
      groups.push({
        dateStr,
        label: getDayHeaderLabel(dateStr, todayStr, yesterdayStr),
        reports: dayReports,
      })
    }

    return groups
  }, [reports, todayStr, yesterdayStr])

  return (
    <div className="reports-screen">
      <header className="reports-header-wrap">
        <div className="reports-header__copy">
          <h1>Reports</h1>
          <p>Triage incoming citizen reports &amp; dispatch field teams</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => setIsLogModalOpen(true)}
        >
          <Plus size={18} weight="bold" />
          <span>+ Log report</span>
        </Button>
      </header>

      <div className="reports-filters-wrap">
        <div className="filter-chips" role="group" aria-label="Report status filter">
          {FILTER_CONFIG.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`chip${activeFilter === key ? ' chip--active' : ''}`}
              aria-pressed={activeFilter === key}
              onClick={() => setActiveFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="timeline-reports-feed" id="reports-timeline-container">
        {groupedReports.map((group) => (
          <div key={group.dateStr} className="timeline-day-group">
            <div className="timeline-date-header">{group.label}</div>
            <div className="timeline-cards-list">
              {group.reports.map((report) => (
                <ReportTimelineCard key={report.id} report={report} />
              ))}
            </div>
          </div>
        ))}

        {!loading && reports.length === 0 ? (
          <div className="reports-empty-state">
            <h3>No rescue reports found</h3>
            <p>
              {activeFilter === 'all'
                ? 'No emergency calls or citizen reports logged yet.'
                : 'No reports match the selected filter.'}
            </p>
          </div>
        ) : null}
      </div>

      <LogReportModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        orgId={orgId}
        orgInitials={orgInitials}
        onReportCreated={() => {
          fetchReports()
        }}
      />
    </div>
  )
}
