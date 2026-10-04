import { type FormEvent, useEffect, useId, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import {
  createStatus,
  type AnimalStatus,
} from '@/features/statuses/domain/statuses'
import { Button } from '@/shared/ui/Button'
import { SelectField, TextField } from '@/shared/ui/Field'

export type CreateStatusModalProps = {
  orgId: string
  onClose: () => void
  onCreated: (status: AnimalStatus) => void
}

export function CreateStatusModal({
  orgId,
  onClose,
  onCreated,
}: CreateStatusModalProps) {
  const db = useDb()
  const titleId = useId()
  const [label, setLabel] = useState('')
  const [countsAsInCare, setCountsAsInCare] = useState<'1' | '0'>('1')
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
      setError('Please enter a status name.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const status = await createStatus(db, {
        orgId,
        label: trimmed,
        countsAsInCare: countsAsInCare === '1',
      })
      onCreated(status)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add status.')
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
          Add status
        </h2>
        <p className="modal-card__subtitle">
          Add an animal status stage for your shelter.
        </p>

        <form className="stack" onSubmit={onSubmit}>
          <TextField
            autoFocus
            label="Status name"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              if (error) setError(null)
            }}
            placeholder="e.g. Intake, Foster, Medical"
            required
          />

          <SelectField
            label="Care stage"
            value={countsAsInCare}
            options={[
              { value: '1', label: 'In care (physically staying with you)' },
              { value: '0', label: 'Not in care (e.g. adopted, transferred)' },
            ]}
            onChange={(val) => setCountsAsInCare(val as '1' | '0')}
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
              {busy ? 'Adding…' : 'Add status'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
