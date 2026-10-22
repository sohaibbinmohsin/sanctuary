import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  getRescueOperationsSummary,
  type RescueOperationsSummary,
} from '@/features/reports/domain/rescueReports'

export function RescueOperationsSummaryCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [summary, setSummary] = useState<RescueOperationsSummary>({
    total: 0,
    awaitingTriage: 0,
    inField: 0,
    attended: 0,
    cancelled: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getRescueOperationsSummary(db, member.orgId)
        if (!cancelled) setSummary(res)
      } catch (err) {
        console.warn('Failed to load rescue operations summary', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  return (
    <section className="overview-panel" aria-labelledby="overview-rescue-ops-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-rescue-ops-title">Rescue operations</h2>
          <p className="muted overview-panel__lede">
            Live citizen report triage and ambulance field status.
          </p>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-card__hero">
          <p className="dashboard-card__count">{loading ? '…' : summary.total}</p>
          <p className="dashboard-card__count-label">Total reports logged</p>
        </div>

        <div className="checklist-summary" style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', boxShadow: 'none' }}>
          <div className="checklist-summary__metric">
            <p className="checklist-summary__value" style={{ color: 'var(--color-amber)' }}>
              {summary.awaitingTriage}
            </p>
            <p className="checklist-summary__label">Awaiting triage</p>
          </div>
          <div className="checklist-summary__metric">
            <p className="checklist-summary__value" style={{ color: 'var(--color-forest)' }}>
              {summary.inField}
            </p>
            <p className="checklist-summary__label">In field</p>
          </div>
          <div className="checklist-summary__metric">
            <p className="checklist-summary__value" style={{ color: 'var(--color-forest)' }}>
              {summary.attended}
            </p>
            <p className="checklist-summary__label">Attended / resolved</p>
          </div>
        </div>
      </div>
    </section>
  )
}
