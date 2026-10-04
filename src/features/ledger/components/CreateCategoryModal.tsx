import { type FormEvent, useEffect, useId, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import {
  createLedgerCategory,
  type LedgerDirection,
} from '@/features/ledger/domain/ledger'
import type { LedgerCategoryRecord } from '@/features/sync/powersync/schema'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextField } from '@/shared/ui/Field'

export type CreateCategoryModalProps = {
  orgId: string
  onClose: () => void
  onCreated: (category: LedgerCategoryRecord) => void
}

export function CreateCategoryModal({
  orgId,
  onClose,
  onCreated,
}: CreateCategoryModalProps) {
  const db = useDb()
  const titleId = useId()
  const [label, setLabel] = useState('')
  const [direction, setDirection] = useState<LedgerDirection>('out')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db) return
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Please enter a category name.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const category = await createLedgerCategory(db, {
        orgId,
        label: trimmed,
        direction,
      })
      onCreated(category)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="confirm-root" role="presentation">
      <button
        type="button"
        className="confirm-backdrop"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="modal-card__title">
          Add category
        </h2>
        <p className="modal-card__subtitle">
          Add a category to track income or expenses.
        </p>

        <form className="stack" onSubmit={onSubmit}>
          <TextField
            autoFocus
            label="Category name"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              if (error) setError(null)
            }}
            placeholder="e.g. Veterinary, Food, Donation"
            required
          />

          <SelectField
            label="Direction"
            value={direction}
            options={[
              { value: 'out', label: 'Money out (expense)' },
              { value: 'in', label: 'Money in (donation / income)' },
            ]}
            onChange={(val) => setDirection(val as LedgerDirection)}
          />

          {error ? <p className="form-error">{error}</p> : null}

          <div className="modal-card__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add category'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
