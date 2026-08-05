import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import {
  addLedgerEntry,
  formatPkr,
  listLedgerCategories,
  listLedgerEntries,
  pkrToCents,
  type LedgerDirection,
} from '@/features/ledger/domain/ledger'
import { searchAnimals } from '@/features/animals/domain/animals'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { LEDGER_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'

export function LedgerScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof listLedgerCategories>>
  >([])
  const [entries, setEntries] = useState<
    Awaited<ReturnType<typeof listLedgerEntries>>
  >([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [animalQuery, setAnimalQuery] = useState('')
  const [animalId, setAnimalId] = useState('')
  const [animalOptions, setAnimalOptions] = useState<
    { id: string; label: string }[]
  >([])
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
  }

  useEffect(() => {
    void reload()
  }, [db, member])

  useEffect(() => {
    if (!db || !member || !animalQuery.trim()) {
      setAnimalOptions([])
      return
    }
    void searchAnimals(db, member.orgId, { query: animalQuery }).then((rows) => {
      setAnimalOptions(
        rows.slice(0, 8).map((a) => ({
          id: a.id,
          label: `${a.shelter_code}${a.name ? ` · ${a.name}` : ''}`,
        })),
      )
    })
  }, [db, member, animalQuery])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !selectedCategory) return
    setError(null)
    try {
      const amountCents = pkrToCents(Number(amount))
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error('Enter a valid amount in PKR')
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
      setAnimalId('')
      setAnimalQuery('')
      setToast(pickMessage(LEDGER_MESSAGES))
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save entry')
    }
  }

  return (
    <section className="screen">
      <h1>Ledger</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Category
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.direction})
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount (PKR)
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
        <label>
          Link animal (optional)
          <input
            placeholder="Search shelter ID or name"
            value={animalQuery}
            onChange={(e) => {
              setAnimalQuery(e.target.value)
              setAnimalId('')
            }}
          />
        </label>
        {animalOptions.length > 0 ? (
          <select
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
          >
            <option value="">No animal</option>
            {animalOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        <label>
          Notes
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary" type="submit">
          Add entry
        </button>
      </form>

      <h2>Recent</h2>
      <div>
        {entries.map((e) => (
          <div className="list-item" key={e.id}>
            <strong>
              {e.direction === 'in' ? '+' : '−'}
              {formatPkr(e.amount_cents ?? 0)}
            </strong>{' '}
            <span className="muted">
              {e.category_label} · {e.entry_date}
            </span>
            {e.notes ? <div>{e.notes}</div> : null}
          </div>
        ))}
        {entries.length === 0 ? (
          <p className="muted">No ledger entries yet.</p>
        ) : null}
      </div>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
