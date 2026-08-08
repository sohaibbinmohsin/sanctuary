import { useEffect, useState } from 'react'
import { CurrencyCircleDollar, Trash } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  deleteLedgerEntry,
  formatPkr,
  listLedgerEntries,
  sumLedger,
} from '@/features/ledger/domain/ledger'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useConfirm } from '@/shared/ui/ConfirmDialog'

function monthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = new Date(y, m, 1).toISOString().slice(0, 10)
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export function LedgerScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const confirm = useConfirm()
  const [entries, setEntries] = useState<
    Awaited<ReturnType<typeof listLedgerEntries>>
  >([])
  const [monthTotals, setMonthTotals] = useState({ inCents: 0, outCents: 0 })
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!db || !member) return
    setEntries(await listLedgerEntries(db, member.orgId))
    setMonthTotals(await sumLedger(db, member.orgId, monthRange()))
  }

  useEffect(() => {
    void reload()
  }, [db, member])

  async function onDeleteEntry(entryId: string) {
    if (!db) return
    const ok = await confirm({
      title: 'Delete this money entry?',
      body: 'This cannot be undone.',
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

  const net = monthTotals.inCents - monthTotals.outCents
  const hasEntries = entries.length > 0

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

      <div className="summary-strip">
        <div className="summary-strip__cell">
          <span className="summary-strip__label">In this month</span>
          <span className="summary-strip__value money-in">
            {formatPkr(monthTotals.inCents)}
          </span>
        </div>
        <div className="summary-strip__cell">
          <span className="summary-strip__label">Out this month</span>
          <span className="summary-strip__value money-out">
            {formatPkr(monthTotals.outCents)}
          </span>
        </div>
        <div className="summary-strip__cell">
          <span className="summary-strip__label">Net</span>
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
          <h2>Recent</h2>
          <div
            className="panel"
            style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
          >
            {entries.map((e) => (
              <div className="list-item list-item--row" key={e.id}>
                <div className="list-item__body">
                  <strong
                    className={e.direction === 'in' ? 'money-in' : 'money-out'}
                  >
                    {e.direction === 'in' ? '+' : '−'}
                    {formatPkr(e.amount_cents ?? 0)}
                  </strong>{' '}
                  <span className="muted">
                    {e.category_label} · {e.entry_date}
                  </span>
                  {e.notes ? <div>{e.notes}</div> : null}
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
        </div>
      )}
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
