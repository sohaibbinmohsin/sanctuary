import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  addLedgerEntry,
  listLedgerCategories,
  pkrToCents,
  type LedgerDirection,
} from '@/features/ledger/domain/ledger'
import { searchAnimals } from '@/features/animals/domain/animals'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { LEDGER_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextareaField, TextField } from '@/shared/ui/Field'

export function LedgerEntryScreen() {
  const db = useDb()
  const navigate = useNavigate()
  const { member } = useCurrentMember()
  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof listLedgerCategories>>
  >([])
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
  const [busy, setBusy] = useState(false)

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  )

  useEffect(() => {
    if (!db || !member) return
    void listLedgerCategories(db, member.orgId).then((cats) => {
      setCategories(cats)
      if (cats[0]) setCategoryId(cats[0].id)
    })
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !member || !selectedCategory) return
    setBusy(true)
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
      setToast(pickMessage(LEDGER_MESSAGES))
      window.setTimeout(() => navigate('/ledger'), 500)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen">
      <PageHeader
        title="Add money entry"
        subtitle="Record a donation or expense."
        backTo="/ledger"
        backLabel="Money"
      />

      <form className="stack stack--loose" onSubmit={onSubmit}>
        <div className="panel stack">
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
                  <ul
                    className="animal-suggest"
                    role="listbox"
                    aria-label="Matching animals"
                  >
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
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions">
          <Button
            type="submit"
            variant="accent"
            block
            disabled={busy || !member || categories.length === 0}
          >
            {busy ? 'Saving…' : 'Save entry'}
          </Button>
        </div>
      </form>
      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
