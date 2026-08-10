import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@powersync/react'
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
import { ensurePartnerLogoCached } from '@/features/settings/domain/partnerLogo'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { DASHBOARD_GREETINGS, pickMessage } from '@/shared/lib/morale/messages'
import { renderDashboardImage } from '@/shared/lib/share/dashboardImage'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/Field'

const GREETING_KEY = 'sanctuary.dashboardGreetingShown'

type OverviewPeriod = 'all' | 'today' | 'yesterday' | 'month' | 'custom'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function dayIso(offsetDays = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayRange(offsetDays = 0): { from: string; to: string } {
  const iso = dayIso(offsetDays)
  return { from: iso, to: iso }
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const { data: orgRows } = useQuery<{ logo_r2_key: string | null }>(
    member?.orgId
      ? `SELECT logo_r2_key FROM organizations WHERE id = ?`
      : `SELECT logo_r2_key FROM organizations WHERE 0`,
    member?.orgId ? [member.orgId] : [],
  )
  const logoR2Key = orgRows?.[0]?.logo_r2_key ?? member?.orgLogoR2Key ?? null

  const activeRange = useMemo(() => {
    if (period === 'today') return dayRange(0)
    if (period === 'yesterday') return dayRange(-1)
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
    let cancelled = false

    async function loadLogo() {
      if (!member) {
        setLogoUrl(null)
        return
      }
      const blob = await ensurePartnerLogoCached(member.orgId, logoR2Key)
      if (cancelled) return
      if (!blob) {
        setLogoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        return
      }
      const url = URL.createObjectURL(blob)
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    }

    void loadLogo()
    return () => {
      cancelled = true
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [member?.orgId, logoR2Key])

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
      : period === 'today'
        ? 'Today'
        : period === 'yesterday'
          ? 'Yesterday'
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
    try {
      const blob = await renderDashboardImage(cardRef.current)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sanctuary-overview-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      URL.revokeObjectURL(url)
      setToast('Image saved')
    } catch (err) {
      console.error('Save image failed', err)
      setToast('Could not save image. Try again.')
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
          aria-pressed={period === 'today'}
          onClick={() => setPeriod('today')}
        >
          Today
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={period === 'yesterday'}
          onClick={() => setPeriod('yesterday')}
        >
          Yesterday
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
        <div className="dashboard-card__header">
          <h2 className="dashboard-card__title">
            {member?.orgName ?? 'Your shelter'}
          </h2>
          {logoUrl ? (
            <img className="dashboard-card__logo" src={logoUrl} alt="" />
          ) : null}
        </div>

        <div className="dashboard-card__hero">
          <p className="dashboard-card__count">{headcount}</p>
          <p className="dashboard-card__count-label">animals in care</p>
        </div>

        <div className="dashboard-card__metrics" aria-label={`Money · ${periodHint}`}>
          <div className="dashboard-card__metric">
            <span className="dashboard-card__metric-label">
              Money in
              <span className="dashboard-card__metric-period"> · {periodHint}</span>
            </span>
            <strong className="money-in">{formatPkr(money.inCents)}</strong>
          </div>
          <div className="dashboard-card__metric">
            <span className="dashboard-card__metric-label">
              Money out
              <span className="dashboard-card__metric-period"> · {periodHint}</span>
            </span>
            <strong className="money-out">{formatPkr(money.outCents)}</strong>
          </div>
          <div className="dashboard-card__metric dashboard-card__metric--net">
            <span className="dashboard-card__metric-label">
              Net
              <span className="dashboard-card__metric-period"> · {periodHint}</span>
            </span>
            <strong className={net >= 0 ? 'money-in' : 'money-out'}>
              {formatPkr(net)}
            </strong>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: '1.25rem' }}>
        <Button type="button" variant="primary" onClick={() => void downloadPng()}>
          Save image
        </Button>
        <Button type="button" variant="secondary" onClick={() => void copySummary()}>
          Copy text
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
