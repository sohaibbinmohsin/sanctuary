import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  countAnimalsByStatus,
  type StatusCount,
} from '@/features/animals/domain/animals'

export function AnimalsByStatusCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const counts = await countAnimalsByStatus(db, member.orgId)
        if (!cancelled) setStatusCounts(counts)
      } catch (err) {
        console.warn('Failed to load animals by status', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const statusMax = Math.max(...statusCounts.map((s) => s.count), 1)

  return (
    <section className="overview-panel" aria-labelledby="overview-status-chart-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-status-chart-title">Animals by status</h2>
          <p className="muted overview-panel__lede">
            Where everyone is right now across shelter locations.
          </p>
        </div>
      </div>

      <div className="panel panel--soft" style={{ padding: 'var(--space-4)' }}>
        {loading && statusCounts.length === 0 ? (
          <p className="muted">Loading statuses…</p>
        ) : statusCounts.length === 0 ? (
          <p className="muted">No animals in care yet.</p>
        ) : (
          <ul className="status-bars">
            {statusCounts.map((s) => (
              <li key={s.statusId} className="status-bars__row">
                <div className="status-bars__meta">
                  <span>{s.label}</span>
                  <strong>{s.count}</strong>
                </div>
                <div className="status-bars__track" aria-hidden>
                  <div
                    className="status-bars__fill"
                    style={{ width: `${(s.count / statusMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
