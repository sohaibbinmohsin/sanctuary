import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { CurrencyCircleDollar, Trash, X } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  addLedgerEntry,
  deleteLedgerEntry,
  formatPkr,
  listLedgerCategories,
  listLedgerEntries,
  pkrToCents,
  sumLedger,
  type LedgerDirection,
} from '@/features/ledger/domain/ledger'
import { searchAnimals } from '@/features/animals/domain/animals'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { LEDGER_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextareaField, TextField } from '@/shared/ui/Field'
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
  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof listLedgerCategories>>
  >([])
  const [entries, setEntries] = useState<
    Awaited<ReturnType<typeof listLedgerEntries>>
  >([])
  const [monthTotals, setMonthTotals] = useState({ inCents: 0, outCents: 0 })
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [animalQuery, setAnimalQuery] = useState('')
  const [animalId, setAnimalId] = useState('')
  const [animalLabel, setAnimalLabel] = useState('')
  const [animalOptions, setAnimalOptions] = useState<
    { id: string; label: string }[]
  >([])
  const [animalSearchBusy, setAnimalSearchBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  )

  async function reload() {
    if (!db || !member) return
    const cats = await listLedgerCategories(db, member.orgId)
    setCategories(cats)
    if (!categoryId && cats[0]) setCategoryId(cats[0].id)
    setEntries(await listLedgerEntries(db, member.orgId))
    setMonthTotals(await sumLedger(db, member.orgId, monthRange()))
  }

  useEffect(() => {
    void reload()
  }, [db, member])

  useEffect(() => {
    if (!db || !member || animalId || !animalQuery.trim()) {
      setAnimalOptions([])
      setAnimalSearchBusy(false)
      return
    }
    let cancelled = false
    setAnimalSearchBusy(true)
    const handle = window.setTimeout(() => {
      void searchAnimals(db, member.orgId, { query: animalQuery })
        .then((rows) => {
          if (cancelled) return
          setAnimalOptions(
            rows.slice(0, 8).map((a) => ({
              id: a.id,
              label: `${a.shelter_code}${a.name ? ` · ${a.name}` : ''}`,
            })),
          )
        })
        .catch((err) => {
          console.warn('Animal search failed', err)
          if (!cancelled) setAnimalOptions([])
        })
        .finally(() => {
          if (!cancelled) setAnimalSearchBusy(false)
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [db, member, animalQuery, animalId])

  function pickAnimal(id: string, label: string) {
    setAnimalId(id)
    setAnimalLabel(label)
    setAnimalQuery('')
    setAnimalOptions([])
  }

  function clearAnimal() {
    setAnimalId('')
    setAnimalLabel('')
    setAnimalQuery('')
    setAnimalOptions([])
  }

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !selectedCategory) return
    setError(null)
    try {
      const amountCents = pkrToCents(Number(amount))
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error('Enter an amount greater than zero.')
      }
      await addLedgerEntry(db, {
        orgId: member.orgId,
        categoryId: selectedCategory.id,
        direction: selectedCategory.direction as LedgerDirection,
        amountCents,
        entryDate,
        notes,
        animalId: animalId || undefined,
      })
      setAmount('')
      setNotes('')
      clearAnimal()
      setToast(pickMessage(LEDGER_MESSAGES))
      await reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save. Please try again.',
      )
    }
  }

  const net = monthTotals.inCents - monthTotals.outCents

  return (
    <section className="screen">
      <PageHeader
        title="Money"
        subtitle="Track donations and expenses for your shelter."
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

      <div className="ledger-layout">
        <form className="panel stack" onSubmit={onSubmit}>
          <p className="section-label">Add entry</p>
          <SelectField
            label="Category"
            value={categoryId}
            options={categories.map((c) => ({
              value: c.id,
              label: `${c.label} (${c.direction === 'in' ? 'money in' : 'money out'})`,
            }))}
            onChange={setCategoryId}
            required
          />
          <TextField
            label="Amount (PKR)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0"
          />
          <TextField
            label="Date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />

          <div className="field">
            <span>
              Link to an animal
              <span className="field__hint"> · optional</span>
            </span>
            {animalId ? (
              <div className="animal-pick animal-pick--selected">
                <span className="shelter-code">{animalLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="btn--icon"
                  aria-label="Remove linked animal"
                  onClick={clearAnimal}
                >
                  <X size={18} weight="bold" aria-hidden />
                </Button>
              </div>
            ) : (
              <>
                <input
                  placeholder="Search by ID or name"
                  value={animalQuery}
                  onChange={(e) => setAnimalQuery(e.target.value)}
                  aria-label="Search animal to link"
                  autoComplete="off"
                />
                {animalSearchBusy ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Searching…
                  </p>
                ) : null}
                {animalOptions.length > 0 ? (
                  <ul className="animal-suggest" role="listbox" aria-label="Matching animals">
                    {animalOptions.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          role="option"
                          className="animal-suggest__item"
                          onClick={() => pickAnimal(o.id, o.label)}
                        >
                          {o.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : animalQuery.trim() && !animalSearchBusy ? (
                  <p className="muted" style={{ margin: 0 }}>
                    No animals match that search.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <TextareaField
            label="Notes"
            hint="optional"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <Button type="submit" variant="primary" block>
            Save entry
          </Button>
        </form>

        <div>
          <h2>Recent</h2>
          {entries.length === 0 ? (
            <EmptyState
              icon={<CurrencyCircleDollar size={28} weight="duotone" />}
              title="No money entries yet"
              body="Add a donation or expense to start your record."
            />
          ) : (
            <div className="panel" style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
              {entries.map((e) => (
                <div className="list-item list-item--row" key={e.id}>
                  <div className="list-item__body">
                    <strong className={e.direction === 'in' ? 'money-in' : 'money-out'}>
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
          )}
        </div>
      </div>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
