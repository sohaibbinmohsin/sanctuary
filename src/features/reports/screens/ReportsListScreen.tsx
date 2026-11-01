import { useEffect, useState, useMemo, useCallback, useDeferredValue, useRef } from 'react'
import { Plus, MagnifyingGlass, X, MegaphoneSimple } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useIncrementalList } from '@/shared/hooks/useIncrementalList'
import { LoadMoreSentinel } from '@/shared/ui/LoadMoreSentinel'
import {
  getRescueReports,
  getRescueOperationsSummary,
  type RescueReport,
  type RescueReportFilter,
  type RescueOperationsSummary,
} from '@/features/reports/domain/rescueReports'
import {
  getBatchReportCompletionMap,
  type ReportCompletionResult,
} from '@/features/reports/domain/reportOutcomes'
import { ReportTimelineCard } from '@/features/reports/components/ReportTimelineCard'
import { localDateString } from '@/shared/lib/checklist/missedStreak'
import {
  getReportsScrollPosition,
  getLastClickedReportId,
  clearReportsScrollPosition,
  saveReportsScrollPosition,
  getAppScrollTop,
  setAppScrollTop,
} from '@/shared/lib/scroll'
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

const PAGE_BATCH_SIZE = 60

export function ReportsListScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [reports, setReports] = useState<RescueReport[]>([])
  const [completionMap, setCompletionMap] = useState<Map<string, ReportCompletionResult>>(new Map())
  const [summary, setSummary] = useState<RescueOperationsSummary | null>(null)
  const [inProgressCount, setInProgressCount] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [loading, setLoading] = useState(true)
  const scrollRestoredRef = useRef(false)
  const defaultSelectedRef = useRef(false)

  const orgId = member?.orgId ?? ''

  // Track scroll position while browsing reports
  useEffect(() => {
    const handleScroll = () => {
      const top = getAppScrollTop()
      if (top > 0) {
        saveReportsScrollPosition()
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    const shellBody = document.querySelector('.app-shell__body')
    shellBody?.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      shellBody?.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const fetchReports = useCallback(async () => {
    if (!db || !orgId) return
    setLoading(true)
    try {
      let targetFilter = activeFilter

      let sum: RescueOperationsSummary | null = null
      // Option 2 (Smart Operational Default):
      // On initial load, inspect counts: prioritize New reports, then In Progress, else All
      if (!defaultSelectedRef.current) {
        defaultSelectedRef.current = true
        sum = await getRescueOperationsSummary(db, orgId)
        setSummary(sum)
        if (sum.awaitingTriage > 0) {
          targetFilter = 'new'
        } else if (sum.inField > 0) {
          targetFilter = 'in_progress'
        } else {
          targetFilter = 'all'
        }

        if (targetFilter !== activeFilter) {
          setActiveFilter(targetFilter)
          return
        }
      } else {
        void getRescueOperationsSummary(db, orgId).then(setSummary).catch(() => {})
      }

      let allReports: RescueReport[] = []
      if (targetFilter === 'in_progress') {
        const [inProgressReports, attendedReports] = await Promise.all([
          getRescueReports(db, orgId, 'in_progress'),
          getRescueReports(db, orgId, 'completed'),
        ])
        const attendedOnly = (attendedReports || []).filter((r) => r.status === 'attended')
        allReports = [...(inProgressReports || []), ...attendedOnly]
      } else {
        allReports = (await getRescueReports(db, orgId, targetFilter as RescueReportFilter)) || []
      }

      // Deduplicate reports by id
      const seenReportIds = new Set<string>()
      const uniqueReports: RescueReport[] = []
      for (const r of allReports) {
        if (!seenReportIds.has(r.id)) {
          seenReportIds.add(r.id)
          uniqueReports.push(r)
        }
      }
      allReports = uniqueReports

      const compMap = await getBatchReportCompletionMap(db, allReports)
      setCompletionMap(compMap)

      let finalReports = allReports
      if (targetFilter === 'completed') {
        finalReports = allReports.filter((r) => {
          if (r.status === 'cancelled') return true
          if (r.disposition_type === 'spot_released' || r.disposition_type === 'deceased_doa') return true
          return compMap.get(r.id)?.isCompleted === true
        })
      } else if (targetFilter === 'in_progress') {
        finalReports = allReports.filter((r) => {
          if (r.status === 'accepted' || r.status === 'dispatched') return true
          if (r.status === 'attended') {
            return compMap.get(r.id)?.isCompleted === false
          }
          return false
        })
        setInProgressCount(finalReports.length)
      } else if (targetFilter === 'all') {
        const inProg = allReports.filter((r) => {
          if (r.status === 'accepted' || r.status === 'dispatched') return true
          if (r.status === 'attended') {
            return compMap.get(r.id)?.isCompleted === false
          }
          return false
        }).length
        setInProgressCount(inProg)
      }

      if (targetFilter !== 'in_progress' && targetFilter !== 'all') {
        void (async () => {
          try {
            const attendedReports = await getRescueReports(db, orgId, 'completed')
            const attendedOnly = (attendedReports || []).filter((r) => r.status === 'attended')
            if (attendedOnly.length > 0) {
              const comp = await getBatchReportCompletionMap(db, attendedOnly)
              const attendedInCare = attendedOnly.filter((r) => comp.get(r.id)?.isCompleted === false).length
              const inFieldCount = sum?.inField ?? summary?.inField ?? 0
              setInProgressCount(inFieldCount + attendedInCare)
            }
          } catch {
            // Ignore background count failure
          }
        })()
      }

      finalReports.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      setReports(finalReports)
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

  const targetReportId = useMemo(() => getLastClickedReportId(), [])

  const {
    visibleItems: visibleReports,
    hasMore,
    remainingCount,
    loadMore,
    sentinelRef,
  } = useIncrementalList(filteredReports, {
    batchSize: PAGE_BATCH_SIZE,
    targetId: targetReportId,
    getId: (r) => r.id,
    resetDeps: [deferredQuery, activeFilter],
  })

  // Restore scroll position when returning to the reports list
  useEffect(() => {
    if (loading || visibleReports.length === 0 || scrollRestoredRef.current) return

    const targetId = getLastClickedReportId()
    const savedTop = getReportsScrollPosition()

    if (!targetId && (!savedTop || savedTop <= 0)) return

    scrollRestoredRef.current = true

    let attempts = 0
    const maxAttempts = 12

    const tryRestore = () => {
      attempts += 1
      let done = false

      if (targetId) {
        const el = document.getElementById(`report-card-${targetId}`)
        if (el) {
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
          }
          if (savedTop && savedTop > 0 && getAppScrollTop() === 0) {
            setAppScrollTop(savedTop)
          }
          done = true
        }
      }

      if (!done && savedTop && savedTop > 0) {
        setAppScrollTop(savedTop)
        if (Math.abs(getAppScrollTop() - savedTop) < 30) {
          done = true
        }
      }

      if (done || attempts >= maxAttempts) {
        clearReportsScrollPosition()
      } else {
        setTimeout(tryRestore, 40)
      }
    }

    requestAnimationFrame(() => {
      tryRestore()
    })
  }, [loading, visibleReports.length])

  // Compute date strings for grouping
  const { todayStr, yesterdayStr } = useMemo(() => {
    const now = new Date()
    const today = localDateString(now)
    const yesterdayDate = new Date(now)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = localDateString(yesterdayDate)
    return { todayStr: today, yesterdayStr: yesterday }
  }, [])

  // Group visible reports chronologically by day
  const groupedReports = useMemo(() => {
    const groups: { dateStr: string; label: string; reports: RescueReport[] }[] = []
    const groupMap = new Map<string, RescueReport[]>()

    for (const report of visibleReports) {
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
  }, [visibleReports, todayStr, yesterdayStr])

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
          loading || filteredReports.length > 0 ? (
            <Button to="/reports/new" variant="accent">
              <Plus size={18} weight="bold" />
              <span>Log report</span>
            </Button>
          ) : undefined
        }
      />

      <div className="reports-search-bar-wrap" style={{ marginBottom: '0.75rem' }}>
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

      <div className="reports-status-filter" role="group" aria-label="Report status filter" style={{ marginBottom: '1.25rem' }}>
        {FILTER_CONFIG.map(({ key, label }) => {
          const count =
            key === 'new'
              ? (summary?.awaitingTriage ?? 0)
              : key === 'in_progress'
                ? (activeFilter === 'in_progress'
                    ? (!loading || reports.length > 0 ? reports.length : (inProgressCount ?? summary?.inField ?? 0))
                    : (inProgressCount ?? summary?.inField ?? 0))
                : 0

          return (
            <button
              key={key}
              type="button"
              className={`chip${activeFilter === key ? ' chip--active' : ''}`}
              aria-pressed={activeFilter === key}
              onClick={() => {
                defaultSelectedRef.current = true
                setActiveFilter(key)
              }}
            >
              <span>{label}</span>
              {count > 0 && <span className="chip-counter">{count}</span>}
            </button>
          )
        })}
      </div>

      {loading && reports.length === 0 ? (
        <div className="timeline-reports-feed" id="reports-timeline-container" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: '4.5rem', marginBottom: '0.65rem' }}
            />
          ))}
        </div>
      ) : !loading && filteredReports.length === 0 ? (
        <EmptyState
          icon={<MegaphoneSimple size={28} weight="duotone" />}
          title={hasSearchOrFilter ? 'No matches' : 'No reports yet'}
          body={
            hasSearchOrFilter
              ? 'Try a different search or clear your filter.'
              : 'Triage incoming citizen reports & dispatch field teams.'
          }
          actionLabel="Log report"
          actionTo="/reports/new"
        />
      ) : (
        <div className="timeline-reports-feed" id="reports-timeline-container">
          {groupedReports.map((group) => (
            <div key={group.dateStr} className="timeline-day-group">
              <div className="timeline-date-header">{group.label}</div>
              <div className="timeline-cards-list">
                {group.reports.map((report) => (
                  <ReportTimelineCard
                    key={report.id}
                    report={report}
                    outcomeStatus={completionMap.get(report.id) ?? null}
                  />
                ))}
              </div>
            </div>
          ))}

          <LoadMoreSentinel
            sentinelRef={sentinelRef}
            hasMore={hasMore}
            remainingCount={remainingCount}
            onLoadMore={loadMore}
            className="timeline-load-more"
          />
        </div>
      )}
    </section>
  )
}

