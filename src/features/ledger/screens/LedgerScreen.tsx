import { useEffect, useMemo, useState } from 'react'
import { CurrencyCircleDollar, PencilSimple } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  currencySymbol,
  formatCurrency,
  formatCurrencyAmount,
  listLedgerEntries,
  sumLedger,
} from '@/features/ledger/domain/ledger'
import { processLedgerAttachmentQueue } from '@/features/ledger/domain/attachments'
import {
  EntryProofThumbs,
  useOrgAttachments,
} from '@/features/ledger/components/EntryProofThumbs'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { TextField } from '@/shared/ui/Field'
import { isPlaygroundMode } from '@/features/playground/mode'

type MoneyPeriod = 'all' | 'today' | 'yesterday' | 'month' | 'custom'

function isAnonymousEntry(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

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

export function LedgerScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const attachments = useOrgAttachments(member?.orgId)
  const [entries, setEntries] = useState<
    Awaited<ReturnType<typeof listLedgerEntries>>
  >([])
  const [period, setPeriod] = useState<MoneyPeriod>('all')
  const [customFrom, setCustomFrom] = useState(() => defaultCustomRange().from)
  const [customTo, setCustomTo] = useState(() => defaultCustomRange().to)
  const [totals, setTotals] = useState({ inCents: 0, outCents: 0 })

  const activeRange = useMemo(() => {
    if (period === 'today') return dayRange(0)
    if (period === 'yesterday') return dayRange(-1)
    if (period === 'month') return monthRange()
    if (period === 'custom') {
      const from = customFrom || undefined
      const to = customTo || undefined
      if (from && to && from > to) {
        return { from: to, to: from }
      }
      return { from, to }
    }
    return {}
  }, [period, customFrom, customTo])

  async function reload() {
    if (!db || !member) return
    setEntries(await listLedgerEntries(db, member.orgId))
    setTotals(await sumLedger(db, member.orgId, activeRange))
  }

  useEffect(() => {
    void reload()
  }, [db, member, activeRange])

  useEffect(() => {
    if (!db || isPlaygroundMode()) return
    const tick = () => {
      if (navigator.onLine) void processLedgerAttachmentQueue(db)
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    window.addEventListener('online', tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('online', tick)
    }
  }, [db])

  const visibleEntries = useMemo(() => {
    if (period === 'all') return entries
    const from = activeRange.from
    const to = activeRange.to
    return entries.filter((e) => {
      const day = e.entry_date ?? ''
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    })
  }, [entries, period, activeRange])

  const net = totals.inCents - totals.outCents
  const hasEntries = entries.length > 0
  const inLabel =
    period === 'all'
      ? 'Money in'
      : period === 'today'
        ? 'In today'
        : period === 'yesterday'
          ? 'In yesterday'
          : period === 'month'
            ? 'In this month'
            : 'Money in'
  const outLabel =
    period === 'all'
      ? 'Money out'
      : period === 'today'
        ? 'Out today'
        : period === 'yesterday'
          ? 'Out yesterday'
          : period === 'month'
            ? 'Out this month'
            : 'Money out'
  const netHint =
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

  return (
    <section className={hasEntries ? 'screen' : 'screen screen--empty'}>
      <PageHeader
        title="Ledger"
        subtitle="Track donations and expenses for your shelter."
        actions={
          hasEntries ? (
            <Button to="/ledger/new" variant="accent">
              Add entry
            </Button>
          ) : undefined
        }
      />

      <div
        className="filter-chips money-period"
        role="group"
        aria-label="Time period"
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

      <div className="summary-strip" aria-label={`Ledger totals · ${netHint}`}>
        <div className="summary-strip__cell">
          <span className="summary-strip__label">{inLabel}</span>
          <span className="summary-strip__value money-in">
            <span className="summary-strip__currency">{currencySymbol(member?.currency)}</span>
            <span className="summary-strip__amount">{formatCurrencyAmount(totals.inCents, member?.currency)}</span>
          </span>
        </div>
        <div className="summary-strip__cell">
          <span className="summary-strip__label">{outLabel}</span>
          <span className="summary-strip__value money-out">
            <span className="summary-strip__currency">{currencySymbol(member?.currency)}</span>
            <span className="summary-strip__amount">{formatCurrencyAmount(totals.outCents, member?.currency)}</span>
          </span>
        </div>
        <div className="summary-strip__cell summary-strip__cell--net">
          <span className="summary-strip__label">Net · {netHint}</span>
          <span
            className={`summary-strip__value ${net >= 0 ? 'money-in' : 'money-out'}`}
          >
            <span className="summary-strip__currency">{currencySymbol(member?.currency)}</span>
            <span className="summary-strip__amount">{formatCurrencyAmount(net, member?.currency)}</span>
          </span>
        </div>
      </div>

      {!hasEntries ? (
        <EmptyState
          icon={<CurrencyCircleDollar size={28} weight="duotone" />}
          title="No ledger entries yet"
          body="Add a donation or expense to start your record."
          actionLabel="Add entry"
          actionTo="/ledger/new"
        />
      ) : (
        <div>
          <h2>
            {period === 'all'
              ? 'All entries'
              : `${visibleEntries.length} entr${visibleEntries.length === 1 ? 'y' : 'ies'} in range`}
          </h2>
          {visibleEntries.length === 0 ? (
            <p className="muted">No entries in this date range.</p>
          ) : (
            <div
              className="panel"
              style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
            >
              {visibleEntries.map((e) => (
                <div className="list-item list-item--row" key={e.id}>
                  <div className="list-item__body">
                    <strong
                      className={`list-item__amount ${
                        e.direction === 'in' ? 'money-in' : 'money-out'
                      }`}
                    >
                      {e.direction === 'in' ? '+' : '−'}
                      {formatCurrency(e.amount_cents ?? 0, member?.currency)}
                    </strong>{' '}
                    <span className="muted">
                      {e.category_label} · {e.entry_date}
                    </span>
                    {e.direction === 'in' && isAnonymousEntry(e.is_anonymous) ? (
                      <span className="muted"> · Anonymous</span>
                    ) : null}
                    {e.notes ? <div>{e.notes}</div> : null}
                    <EntryProofThumbs
                      entryId={e.id}
                      attachments={attachments}
                    />
                  </div>
                  <div className="list-item__actions">
                    <Button
                      to={`/ledger/${e.id}`}
                      variant="ghost"
                      className="btn--icon"
                      aria-label="Edit ledger entry"
                      title="Edit"
                    >
                      <PencilSimple size={18} weight="bold" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
