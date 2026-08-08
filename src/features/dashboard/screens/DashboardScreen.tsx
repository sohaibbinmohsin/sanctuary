import { useEffect, useMemo, useRef, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import {
  countAnimalsByStatus,
  countInCare,
  type StatusCount,
} from '@/features/animals/domain/animals'
import {
  formatPkr,
  sumLedger,
  sumLedgerByMonth,
  type MonthlyLedgerPoint,
} from '@/features/ledger/domain/ledger'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { DASHBOARD_GREETINGS, pickMessage } from '@/shared/lib/morale/messages'
import { renderDashboardImage } from '@/shared/lib/share/dashboardImage'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/Field'

const GREETING_KEY = 'sanctuary.dashboardGreetingShown'

type OverviewPeriod = 'all' | 'month' | 'custom'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = new Date(y, m, 1).toISOString().slice(0, 10)
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

function monthLabel(now = new Date()): string {
  return now.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function formatDay(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function defaultCustomRange(): { from: string; to: string } {
  const to = todayIso()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 30)
  return { from: fromDate.toISOString().slice(0, 10), to }
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString(undefined, { month: 'short' })
}

export function DashboardScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const cardRef = useRef<HTMLDivElement>(null)
  const [headcount, setHeadcount] = useState(0)
  const [money, setMoney] = useState({ inCents: 0, outCents: 0 })
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([])
  const [monthly, setMonthly] = useState<MonthlyLedgerPoint[]>([])
  const [period, setPeriod] = useState<OverviewPeriod>('month')
  const [customFrom, setCustomFrom] = useState(() => defaultCustomRange().from)
  const [customTo, setCustomTo] = useState(() => defaultCustomRange().to)
  const [greeting, setGreeting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const activeRange = useMemo(() => {
    if (period === 'month') return monthRange()
    if (period === 'custom') {
      const from = customFrom || undefined
      const to = customTo || undefined
      if (from && to && from > to) return { from: to, to: from }
      return { from, to }
    }
    return {}
  }, [period, customFrom, customTo])

  useEffect(() => {
    if (!db || !member) return
    void countInCare(db, member.orgId).then(setHeadcount)
    void countAnimalsByStatus(db, member.orgId).then(setStatusCounts)
    void sumLedgerByMonth(db, member.orgId, 6).then(setMonthly)

    if (!sessionStorage.getItem(GREETING_KEY)) {
      sessionStorage.setItem(GREETING_KEY, '1')
      setGreeting(pickMessage(DASHBOARD_GREETINGS))
    }
  }, [db, member])

  useEffect(() => {
    if (!db || !member) return
    void sumLedger(db, member.orgId, activeRange).then(setMoney)
  }, [db, member, activeRange])

  const net = money.inCents - money.outCents
  const statusMax = Math.max(...statusCounts.map((s) => s.count), 1)
  const moneyMax = Math.max(
    ...monthly.flatMap((p) => [p.inCents, p.outCents]),
    1,
  )
  const periodHint =
    period === 'all'
      ? 'All time'
      : period === 'month'
        ? monthLabel()
        : customFrom && customTo
          ? `${formatDay(customFrom)} to ${formatDay(customTo)}`
          : 'Custom range'

  const summaryText = [
    member?.orgName ?? 'Sanctuary',
    `In care: ${headcount}`,
    `Money in (${periodHint}): ${formatPkr(money.inCents)}`,
    `Money out (${periodHint}): ${formatPkr(money.outCents)}`,
    `Net (${periodHint}): ${formatPkr(net)}`,
  ].join('\n')

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText)
    setToast('Summary copied')
  }

  async function downloadPng() {
    if (!cardRef.current) return
    const blob = await renderDashboardImage(cardRef.current)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sanctuary-overview-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
    URL.revokeObjectURL(url)
    setToast('Image saved')
  }

  async function shareImage() {
    if (!cardRef.current) return
    const blob = await renderDashboardImage(cardRef.current)
    const file = new File([blob], 'sanctuary-overview.png', {
      type: 'image/png',
    })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: member?.orgName ?? 'Sanctuary',
        text: summaryText,
      })
      setToast('Shared')
    } else {
      await downloadPng()
    }
  }

  return (
    <section className="screen">
      <PageHeader
        title="Overview"
        subtitle={greeting ?? 'A quick look for you, and for supporters.'}
      />

      <div
        className="filter-chips money-period"
        role="group"
        aria-label="Money period for share card"
      >
        <button
          type="button"
          className="chip"
          aria-pressed={period === 'all'}
          onClick={() => setPeriod('all')}
        >
          All time
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={period === 'month'}
          onClick={() => setPeriod('month')}
        >
          This month
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={period === 'custom'}
          onClick={() => setPeriod('custom')}
        >
          Custom
        </button>
      </div>

      {period === 'custom' ? (
        <div className="money-range panel panel--soft">
          <TextField
            label="From"
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <TextField
            label="To"
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </div>
      ) : null}

      <div className="dashboard-card" ref={cardRef}>
        <h2 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>
          {member?.orgName ?? 'Your shelter'}
        </h2>
        <p className="dashboard-card__count">{headcount}</p>
        <p className="muted" style={{ margin: 0 }}>
          animals in care
        </p>
        <div className="row" style={{ marginTop: '1.25rem', gap: '2rem' }}>
          <div>
            <div className="muted">Money in · {periodHint}</div>
            <strong className="money-in">{formatPkr(money.inCents)}</strong>
          </div>
          <div>
            <div className="muted">Money out · {periodHint}</div>
            <strong className="money-out">{formatPkr(money.outCents)}</strong>
          </div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <div className="muted">Net · {periodHint}</div>
          <strong className={net >= 0 ? 'money-in' : 'money-out'}>
            {formatPkr(net)}
          </strong>
        </div>
      </div>

      <div className="row" style={{ marginTop: '1.25rem' }}>
        <Button type="button" variant="primary" onClick={() => void shareImage()}>
          Share
        </Button>
        <Button type="button" variant="secondary" onClick={() => void copySummary()}>
          Copy text
        </Button>
        <Button type="button" variant="ghost" onClick={() => void downloadPng()}>
          Save image
        </Button>
      </div>

      <section className="overview-panel" aria-labelledby="status-chart-title">
        <h2 id="status-chart-title">Animals by status</h2>
        <p className="muted overview-panel__lede">
          Where everyone is right now. Tap Animals to dig in.
        </p>
        {statusCounts.length === 0 ? (
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
      </section>

      <section className="overview-panel" aria-labelledby="money-chart-title">
        <h2 id="money-chart-title">Money trend</h2>
        <p className="muted overview-panel__lede">
          Last 6 months. Green is money in, amber is money out.
        </p>
        <div className="trend-legend" aria-hidden>
          <span className="trend-legend__item trend-legend__item--in">In</span>
          <span className="trend-legend__item trend-legend__item--out">Out</span>
        </div>
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
                    title={`In ${formatPkr(point.inCents)}`}
                  />
                  <div
                    className="money-trend__bar money-trend__bar--out"
                    style={{ height: `${outH}%` }}
                    title={`Out ${formatPkr(point.outCents)}`}
                  />
                </div>
                <span className="money-trend__label">{shortMonth(point.month)}</span>
              </div>
            )
          })}
        </div>
      </section>

      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
