import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import {
  addLedgerEntry,
  deleteLedgerEntry,
  getLedgerEntry,
  listLedgerCategories,
  pkrToCents,
  updateLedgerEntry,
  type LedgerDirection,
} from '@/features/ledger/domain/ledger'
import {
  processLedgerAttachmentQueue,
  queueLedgerAttachment,
} from '@/features/ledger/domain/attachments'
import { ProofCapture } from '@/features/ledger/components/ProofCapture'
import { searchAnimals, getAnimal } from '@/features/animals/domain/animals'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { LEDGER_MESSAGES, pickMessage } from '@/shared/lib/morale/messages'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextareaField, TextField } from '@/shared/ui/Field'
import { useConfirm } from '@/shared/ui/ConfirmDialog'
import { isPlaygroundMode } from '@/features/playground/mode'
import { AnimalLoader } from '@/shared/ui/AnimalLoader'

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function LedgerEntryScreen() {
  const { id: entryId } = useParams<{ id: string }>()
  const isEdit = Boolean(entryId)
  const db = useDb()
  const navigate = useNavigate()
  const confirm = useConfirm()
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
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [hideFromPublic, setHideFromPublic] = useState(false)
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingEntry, setLoadingEntry] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  )
  const isDonation = selectedCategory?.direction === 'in'

  useEffect(() => {
    if (!db || !member) return
    void listLedgerCategories(db, member.orgId).then((cats) => {
      setCategories(cats)
      if (!isEdit && cats[0]) setCategoryId((current) => current || cats[0].id)
    })
  }, [db, member, isEdit])

  useEffect(() => {
    if (!db || !member || !isEdit || !entryId) {
      setLoadingEntry(false)
      return
    }
    let cancelled = false
    setLoadingEntry(true)
    void (async () => {
      try {
        const entry = await getLedgerEntry(db, entryId)
        if (cancelled) return
        if (!entry || entry.org_id !== member.orgId) {
          setNotFound(true)
          return
        }
        setCategoryId(entry.category_id ?? '')
        setAmount(String((entry.amount_cents ?? 0) / 100))
        setEntryDate(entry.entry_date ?? new Date().toISOString().slice(0, 10))
        setNotes(entry.notes ?? '')
        setIsAnonymous(isTruthyFlag(entry.is_anonymous))
        setHideFromPublic(isTruthyFlag(entry.hide_from_public))
        if (entry.animal_id) {
          setAnimalId(entry.animal_id)
          const animal = await getAnimal(db, entry.animal_id)
          if (animal) {
            setAnimalLabel(
              `${animal.shelter_code}${animal.name ? ` · ${animal.name}` : ''}`,
            )
          } else {
            setAnimalLabel(entry.animal_id)
          }
        }
      } catch (err) {
        console.warn('Failed to load ledger entry', err)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoadingEntry(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member, isEdit, entryId])

  useEffect(() => {
    if (!isDonation) setIsAnonymous(false)
  }, [isDonation])

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
      const direction = selectedCategory.direction as LedgerDirection
      if (isEdit && entryId) {
        await updateLedgerEntry(db, entryId, {
          categoryId: selectedCategory.id,
          direction,
          amountCents,
          entryDate,
          notes,
          animalId: animalId || null,
          isAnonymous: direction === 'in' ? isAnonymous : false,
          hideFromPublic,
        })
        setToast('Entry updated')
      } else {
        const entry = await addLedgerEntry(db, {
          orgId: member.orgId,
          categoryId: selectedCategory.id,
          direction,
          amountCents,
          entryDate,
          notes,
          animalId: animalId || undefined,
          isAnonymous: direction === 'in' ? isAnonymous : false,
          hideFromPublic,
        })
        for (const file of proofFiles) {
          await queueLedgerAttachment(db, {
            orgId: member.orgId,
            entryId: entry.id,
            blob: file,
          })
        }
        if (proofFiles.length > 0 && !isPlaygroundMode() && navigator.onLine) {
          void processLedgerAttachmentQueue(db)
        }
        setToast(pickMessage(LEDGER_MESSAGES))
      }
      window.setTimeout(() => navigate('/ledger'), 500)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!db || !entryId) return
    const ok = await confirm({
      title: 'Delete this ledger entry?',
      body: 'Attached proof will be deleted too. This cannot be undone.',
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await deleteLedgerEntry(db, entryId)
      navigate('/ledger', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete entry. Try again.',
      )
      setBusy(false)
    }
  }

  if (loadingEntry) {
    return (
      <section className="screen">
        <AnimalLoader label="Loading entry…" />
      </section>
    )
  }

  if (notFound) {
    return (
      <section className="screen">
        <PageHeader
          title="Entry not found"
          subtitle="It may have been deleted."
          backTo="/ledger"
          backLabel="Ledger"
        />
      </section>
    )
  }

  return (
    <section className="screen screen--sticky-footer">
      <PageHeader
        title={isEdit ? 'Edit ledger entry' : 'Add ledger entry'}
        subtitle={
          isEdit
            ? 'Update details, proof, or delete this entry.'
            : 'Record a donation or expense.'
        }
        backTo="/ledger"
        backLabel="Ledger"
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

          {isDonation ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <span>
                Anonymous donation
                <span className="field__hint">
                  {' '}
                  · Hides proof attachments on the public page.
                </span>
              </span>
            </label>
          ) : null}

          <label className="check-row">
            <input
              type="checkbox"
              checked={hideFromPublic}
              onChange={(e) => setHideFromPublic(e.target.checked)}
            />
            <span>Hide from public</span>
          </label>

          {member ? (
            <ProofCapture
              orgId={member.orgId}
              entryId={isEdit ? entryId : undefined}
              pendingFiles={isEdit ? undefined : proofFiles}
              onPendingFilesChange={isEdit ? undefined : setProofFiles}
            />
          ) : null}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions stack">
          <Button
            type="submit"
            variant="accent"
            block
            disabled={busy || !member || categories.length === 0}
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save entry'}
          </Button>
        </div>
      </form>

      {isEdit ? (
        <div className="danger-zone">
          <div className="danger-zone__row">
            <p className="detail-section-heading">Delete entry</p>
            <Button
              type="button"
              variant="danger-outline"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              Delete entry
            </Button>
          </div>
          <p className="muted danger-zone__copy">
            Remove this entry and any attached proof.
          </p>
        </div>
      ) : null}

      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
