import { useEffect, useMemo, useState } from 'react'
import { CurrencyCircleDollar, Trash } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  deleteLedgerEntry,
  formatPkr,
  listLedgerEntries,
  sumLedger,
} from '@/features/ledger/domain/ledger'
import { EntryProof } from '@/features/ledger/components/EntryProof'
import { processLedgerAttachmentQueue } from '@/features/ledger/domain/attachments'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import { TextField } from '@/shared/ui/Field'
import { isPlaygroundMode } from '@/features/playground/mode'

type MoneyPeriod = 'all' | 'month' | 'custom'

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

export function LedgerScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const confirm = useConfirm()
  const [entries, setEntries] = useState<
    Awaited<ReturnType<typeof listLedgerEntries>>
  >([])
  const [period, setPeriod] = useState<MoneyPeriod>('all')
  const [customFrom, setCustomFrom] = useState(() => defaultCustomRange().from)
  const [customTo, setCustomTo] = useState(() => defaultCustomRange().to)
  const [totals, setTotals] = useState({ inCents: 0, outCents: 0 })
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function onDeleteEntry(entryId: string) {
    if (!db) return
    const ok = await confirm({
      title: 'Delete this money entry?',
      body: 'Attached proof will be deleted too. This cannot be undone.',
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteLedgerEntry(db, entryId)
      setToast('Money entry deleted')
      await reload()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete entry. Try again.',
      )
    }
  }

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
    <section className="screen">
      <PageHeader
        title="Money"
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

      <div className="summary-strip">
        <div className="summary-strip__cell">
          <span className="summary-strip__label">{inLabel}</span>
          <span className="summary-strip__value money-in">
            {formatPkr(totals.inCents)}
          </span>
        </div>
        <div className="summary-strip__cell">
          <span className="summary-strip__label">{outLabel}</span>
          <span className="summary-strip__value money-out">
            {formatPkr(totals.outCents)}
          </span>
        </div>
        <div className="summary-strip__cell">
          <span className="summary-strip__label">Net · {netHint}</span>
          <span
            className={`summary-strip__value ${net >= 0 ? 'money-in' : 'money-out'}`}
          >
            {formatPkr(net)}
          </span>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {!hasEntries ? (
        <EmptyState
          icon={<CurrencyCircleDollar size={28} weight="duotone" />}
          title="No money entries yet"
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
                      className={
                        e.direction === 'in' ? 'money-in' : 'money-out'
                      }
                    >
                      {e.direction === 'in' ? '+' : '−'}
                      {formatPkr(e.amount_cents ?? 0)}
                    </strong>{' '}
                    <span className="muted">
                      {e.category_label} · {e.entry_date}
                    </span>
                    {e.notes ? <div>{e.notes}</div> : null}
                    {member ? (
                      <EntryProof orgId={member.orgId} entryId={e.id} />
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="danger-ghost"
                    className="btn--icon"
                    aria-label="Delete money entry"
                    onClick={() => void onDeleteEntry(e.id)}
                  >
                    <Trash size={18} weight="bold" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
