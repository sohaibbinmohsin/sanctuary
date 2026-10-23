import { useState, useEffect, type FormEvent } from 'react'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import { TextareaField } from '@/shared/ui/Field'
import { Button } from '@/shared/ui/Button'
import { Scales } from '@phosphor-icons/react'

export type LegalActionModalProps = {
  isOpen: boolean
  onClose: () => void
  initialNotes?: string | null
  onSave: (notes: string) => Promise<void>
  isEditingOnly?: boolean
}

export function LegalActionModal({
  isOpen,
  onClose,
  initialNotes,
  onSave,
  isEditingOnly = false,
}: LegalActionModalProps) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes || '')
      setError(null)
      setSubmitting(false)
    }
  }, [isOpen, initialNotes])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = notes.trim()
    if (!trimmed) {
      setError('Legal action details are mandatory to move to this stage.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSave(trimmed)
      onClose()
    } catch (err) {
      console.error('Failed to save legal action notes', err)
      setError('Failed to save legal action. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditingOnly ? 'Edit Legal Action & Notice' : 'Log Notice / Legal Action'}
    >
      <form onSubmit={handleSubmit} className="stack">
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Record the official warning notice issued, Police FIR number, station, or legal actions taken against the violator.
        </p>

        <TextareaField
          label="Legal action details / Notice summary *"
          placeholder="e.g. Warning notice issued under Animal Cruelty Act 1890, Police FIR #402/26 registered at Saddar PS. Owner instructed to cease heavy labor."
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            if (error) setError(null)
          }}
          rows={4}
        />

        {error && <p className="form-error" style={{ color: 'var(--color-danger, #b91c1c)', fontSize: '0.875rem', margin: 0 }}>{error}</p>}

        <div className="responsive-modal__actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <Button type="submit" variant="primary" disabled={submitting}>
            <Scales size={16} weight="bold" aria-hidden />
            <span>{submitting ? 'Saving…' : isEditingOnly ? 'Save changes' : 'Record & Proceed'}</span>
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </ResponsiveSheetModal>
  )
}
