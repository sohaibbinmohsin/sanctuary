import { useState, useEffect, type FormEvent } from 'react'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import { TextareaField } from '@/shared/ui/Field'
import { Button } from '@/shared/ui/Button'
import { XCircle } from '@phosphor-icons/react'

export type DismissReportModalProps = {
  isOpen: boolean
  onClose: () => void
  isCruelty: boolean
  onConfirm: (reason: string) => Promise<void>
}

export function DismissReportModal({
  isOpen,
  onClose,
  isCruelty,
  onConfirm,
}: DismissReportModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setReason('')
      setError(null)
      setSubmitting(false)
    }
  }, [isOpen])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setError(
        isCruelty
          ? 'Reason is mandatory to dismiss or close a cruelty complaint.'
          : 'Reason is mandatory to decline or cancel a rescue report.',
      )
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(trimmed)
      onClose()
    } catch (err) {
      console.error('Failed to dismiss report', err)
      setError('Failed to dismiss case. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = isCruelty ? 'Dismiss / Close Complaint' : 'Decline / Cancel Report'

  return (
    <ResponsiveSheetModal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="stack">
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          {isCruelty
            ? 'State the official investigation findings or rationale for closing or dismissing this cruelty complaint without further legal action.'
            : 'Please specify the rationale for declining or cancelling this emergency rescue dispatch.'}
        </p>

        <TextareaField
          label={isCruelty ? 'Reason for dismissal / closure *' : 'Reason for cancellation *'}
          placeholder={
            isCruelty
              ? 'e.g. Investigation on site found animal in good health and living conditions; false or retaliatory report.'
              : 'e.g. False alarm, animal already rescued by citizen, or unable to locate at given location.'
          }
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            if (error) setError(null)
          }}
          rows={4}
        />

        {error && (
          <p
            className="form-error"
            style={{ color: 'var(--color-danger, #b91c1c)', fontSize: '0.875rem', margin: 0 }}
          >
            {error}
          </p>
        )}

        <div className="responsive-modal__actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <Button type="submit" variant="danger" disabled={submitting}>
            <XCircle size={16} weight="bold" aria-hidden />
            <span>{submitting ? 'Dismissing…' : isCruelty ? 'Dismiss Complaint' : 'Decline Report'}</span>
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Keep Case Open
          </Button>
        </div>
      </form>
    </ResponsiveSheetModal>
  )
}
