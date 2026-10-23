import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  formatCurrency,
  sumLedger,
} from '@/features/ledger/domain/ledger'

export function FinancialSummaryCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [money, setMoney] = useState({ inCents: 0, outCents: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await sumLedger(db, member.orgId, {})
        if (!cancelled) setMoney(res)
      } catch (err) {
        console.warn('Failed to load financial summary', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const net = money.inCents - money.outCents

  return (
    <section className="overview-panel" aria-labelledby="overview-financial-summary-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-financial-summary-title">Financial summary</h2>
          <p className="muted overview-panel__lede">
            All-time financial totals across donations, supplies, and veterinary care.
          </p>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-card__hero">
          <p className={`dashboard-card__count ${net >= 0 ? 'money-in' : 'money-out'}`} style={{ fontSize: 'clamp(1.75rem, 5vw, 2.25rem)' }}>
            {loading ? '…' : formatCurrency(net, member?.currency)}
          </p>
          <p className="dashboard-card__count-label">Net balance</p>
        </div>

        <div
          className="dashboard-card__metrics"
          aria-label="Financial metrics"
        >
          <div className="dashboard-card__metric">
            <span className="dashboard-card__metric-label">
              Money in
            </span>
            <strong className="money-in">{formatCurrency(money.inCents, member?.currency)}</strong>
          </div>
          <div className="dashboard-card__metric">
            <span className="dashboard-card__metric-label">
              Money out
            </span>
            <strong className="money-out">{formatCurrency(money.outCents, member?.currency)}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
