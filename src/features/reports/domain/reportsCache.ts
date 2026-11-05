import type { RescueReport, RescueOperationsSummary } from './rescueReports'

export type FilterKey = 'all' | 'new' | 'in_progress' | 'completed'

export interface CachedReportsState {
  reports: RescueReport[]
  reportsByFilter: Partial<Record<FilterKey, RescueReport[]>>
  summary: RescueOperationsSummary | null
  activeFilter: FilterKey
  displayLimit: number
  searchQuery: string
  lastFetchedAt: number
}

// In-memory cache across navigation returns
const reportsCacheByOrg = new Map<string, CachedReportsState>()

export function getCachedReports(orgId: string): CachedReportsState | null {
  if (!orgId) return null
  return reportsCacheByOrg.get(orgId) ?? null
}

export function setCachedReports(orgId: string, state: CachedReportsState): void {
  if (!orgId) return
  reportsCacheByOrg.set(orgId, state)
}

export function updateReportInCache(report: Partial<RescueReport> & { id: string }): void {
  for (const [, state] of reportsCacheByOrg.entries()) {
    const idx = state.reports.findIndex((r) => r.id === report.id)
    if (idx !== -1) {
      state.reports[idx] = { ...state.reports[idx], ...report }
    }
    for (const filterKey of Object.keys(state.reportsByFilter) as FilterKey[]) {
      const list = state.reportsByFilter[filterKey]
      if (list) {
        const fIdx = list.findIndex((r) => r.id === report.id)
        if (fIdx !== -1) {
          list[fIdx] = { ...list[fIdx], ...report }
        }
      }
    }
  }
}

export function invalidateReportsCache(orgId?: string): void {
  if (orgId) {
    reportsCacheByOrg.delete(orgId)
  } else {
    reportsCacheByOrg.clear()
  }
}
