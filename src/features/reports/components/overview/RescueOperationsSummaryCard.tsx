import { useEffect, useState } from 'react'
import { Siren, Clock, Car, CheckCircle } from '@phosphor-icons/react'
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
        <div className="dashboard-card__header">
          <div className="dashboard-card__title-group">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--color-forest)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Siren size={16} weight="duotone" aria-hidden />
              Field Activity
            </span>
          </div>
        </div>

        <div className="dashboard-card__hero">
          <p className="dashboard-card__count">{loading ? '…' : summary.total}</p>
          <p className="dashboard-card__count-label">total reports logged</p>
        </div>

        <div className="checklist-summary" style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', boxShadow: 'none' }}>
          <div className="checklist-summary__metric">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-brand)' }}>
              <Clock size={16} weight="bold" aria-hidden />
              <p className="checklist-summary__value">{summary.awaitingTriage}</p>
            </div>
            <p className="checklist-summary__label">awaiting triage</p>
          </div>
          <div className="checklist-summary__metric">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-forest)' }}>
              <Car size={16} weight="bold" aria-hidden />
              <p className="checklist-summary__value">{summary.inField}</p>
            </div>
            <p className="checklist-summary__label">in field</p>
          </div>
          <div className="checklist-summary__metric">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-forest)' }}>
              <CheckCircle size={16} weight="bold" aria-hidden />
              <p className="checklist-summary__value">{summary.attended}</p>
            </div>
            <p className="checklist-summary__label">attended / resolved</p>
          </div>
        </div>
      </div>
    </section>
  )
}
