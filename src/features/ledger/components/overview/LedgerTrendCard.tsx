import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  formatCurrency,
  sumLedgerByMonth,
  type MonthlyLedgerPoint,
} from '@/features/ledger/domain/ledger'

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString(undefined, { month: 'short' })
}

export function LedgerTrendCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [monthly, setMonthly] = useState<MonthlyLedgerPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await sumLedgerByMonth(db, member.orgId, 6)
        if (!cancelled) setMonthly(res)
      } catch (err) {
        console.warn('Failed to load ledger trend', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const moneyMax = Math.max(
    ...monthly.flatMap((p) => [p.inCents, p.outCents]),
    1,
  )

  return (
    <section className="overview-panel" aria-labelledby="overview-ledger-trend-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-ledger-trend-title">Ledger trend</h2>
          <p className="muted overview-panel__lede">
            Last 6 months. Green is money in, amber is money out.
          </p>
        </div>
      </div>

      <div className="panel panel--soft" style={{ padding: 'var(--space-4)' }}>
        <div className="trend-legend" aria-hidden>
          <span className="trend-legend__item trend-legend__item--in">In</span>
          <span className="trend-legend__item trend-legend__item--out">Out</span>
        </div>
        {loading && monthly.length === 0 ? (
          <p className="muted">Loading trend…</p>
        ) : (
          <div
            className="money-trend"
            role="img"
            aria-label="Bar chart of money in and out for the last six months"
          >
            {monthly.map((point) => {
              const inH = Math.max((point.inCents / moneyMax) * 100, point.inCents > 0 ? 4 : 0)
              const outH = Math.max(
                (point.outCents / moneyMax) * 100,
                point.outCents > 0 ? 4 : 0,
              )
              return (
                <div key={point.month} className="money-trend__col">
                  <div className="money-trend__bars">
                    <div
                      className="money-trend__bar money-trend__bar--in"
                      style={{ height: `${inH}%` }}
                      title={`In ${formatCurrency(point.inCents, member?.currency)}`}
                    />
                    <div
                      className="money-trend__bar money-trend__bar--out"
                      style={{ height: `${outH}%` }}
                      title={`Out ${formatCurrency(point.outCents, member?.currency)}`}
                    />
                  </div>
                  <span className="money-trend__label">{shortMonth(point.month)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
