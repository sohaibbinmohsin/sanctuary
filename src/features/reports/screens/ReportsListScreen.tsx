import { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react'
import { Plus, MagnifyingGlass, X, MegaphoneSimple } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  getRescueReports,
  type RescueReport,
  type RescueReportFilter,
} from '@/features/reports/domain/rescueReports'
import { ReportTimelineCard } from '@/features/reports/components/ReportTimelineCard'
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
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [loading, setLoading] = useState(true)

  const orgId = member?.orgId ?? ''

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

  // Filter reports by search query
  const filteredReports = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return reports

    return reports.filter((r) => {
      const num = (r.report_number || '').toLowerCase()
      const species = (r.species || '').toLowerCase()
      const complaint = (r.chief_complaint || '').toLowerCase()
      const area = (r.location_area || '').toLowerCase()
      const landmark = (r.location_landmark || '').toLowerCase()
      const rep = (r.reporter_name || '').toLowerCase()
      return (
        num.includes(q) ||
        species.includes(q) ||
        complaint.includes(q) ||
        area.includes(q) ||
        landmark.includes(q) ||
        rep.includes(q)
      )
    })
  }, [reports, deferredQuery])

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

    for (const report of filteredReports) {
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
  }, [filteredReports, todayStr, yesterdayStr])

  const hasSearchOrFilter = Boolean(searchQuery.trim() || activeFilter !== 'all')

  const subtitle = !member?.orgName
    ? loading
      ? 'Loading reports…'
      : 'Triage incoming citizen reports & dispatch field teams'
    : hasSearchOrFilter
      ? `${filteredReports.length} report${filteredReports.length === 1 ? '' : 's'} matching`
      : `${reports.length} report${reports.length === 1 ? '' : 's'} logged at ${member.orgName}`

  return (
    <section className={loading || filteredReports.length > 0 ? 'screen' : 'screen screen--empty'}>
      <PageHeader
        title="Reports"
        subtitle={subtitle}
        actions={
          reports.length > 0 || hasSearchOrFilter ? (
            <Button to="/reports/new" variant="accent">
              <Plus size={18} weight="bold" />
              <span>Log report</span>
            </Button>
          ) : undefined
        }
      />

      <div className="filter-bar filter-bar--chrome" style={{ marginBottom: '0.75rem' }}>
        <div className="filter-bar__search">
          <MagnifyingGlass size={18} weight="bold" aria-hidden />
          <input
            type="search"
            placeholder="Search by ID, species, complaint, or location"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search reports"
          />
          {searchQuery ? (
            <button
              type="button"
              className="filter-bar__clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="filter-chips" role="group" aria-label="Report status filter" style={{ marginBottom: '1.25rem' }}>
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

      {!loading && filteredReports.length === 0 ? (
        <EmptyState
          icon={<MegaphoneSimple size={28} weight="duotone" />}
          title={hasSearchOrFilter ? 'No matches' : 'No reports yet'}
          body={
            hasSearchOrFilter
              ? 'Try a different search or clear your filter.'
              : 'Triage incoming citizen reports & dispatch field teams.'
          }
          actionLabel={hasSearchOrFilter ? undefined : 'Log report'}
          actionTo={hasSearchOrFilter ? undefined : '/reports/new'}
        />
      ) : (
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
        </div>
      )}
    </section>
  )
}
