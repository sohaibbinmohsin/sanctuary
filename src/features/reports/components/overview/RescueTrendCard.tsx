import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  getRescueMonthlyTrend,
  type RescueMonthlyTrend,
} from '@/features/reports/domain/rescueReports'

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString(undefined, { month: 'short' })
}

export function RescueTrendCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [trend, setTrend] = useState<RescueMonthlyTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getRescueMonthlyTrend(db, member.orgId, 6)
        if (!cancelled) setTrend(res)
      } catch (err) {
        console.warn('Failed to load rescue trend', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const maxVal = Math.max(...trend.map((t) => t.count), 1)

  return (
    <section className="overview-panel" aria-labelledby="overview-rescue-trend-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-rescue-trend-title">Rescue trend</h2>
          <p className="muted overview-panel__lede">
            Cases reported each month for the last 6 months.
          </p>
        </div>
      </div>

      {loading && trend.length === 0 ? (
        <p className="muted">Loading trend…</p>
      ) : (
        <div
          className="money-trend"
          role="img"
          aria-label="Bar chart of rescue cases for the last six months"
        >
          {trend.map((point) => {
            const h = Math.max((point.count / maxVal) * 100, point.count > 0 ? 6 : 0)
            return (
              <div key={point.month} className="money-trend__col">
                <div className="money-trend__bars">
                  <div
                    className="money-trend__bar"
                    style={{
                      height: `${h}%`,
                      background: 'var(--color-forest)',
                    }}
                    title={`${point.count} cases in ${shortMonth(point.month)}`}
                  />
                </div>
                <span className="money-trend__label">{shortMonth(point.month)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
