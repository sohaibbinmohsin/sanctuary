import { CaretDown, CaretUp, Plus, Trash } from '@phosphor-icons/react'
import type { StatusDraft } from '@/features/onboarding/domain/onboarding'
import { Button } from '@/shared/ui/Button'
import { SelectField } from '@/shared/ui/SelectField'

export type StepStatusesProps = {
  statuses: StatusDraft[]
  onStatusesChange: (statuses: StatusDraft[]) => void
  onBack: () => void
  onNext: () => void
}

export function StepStatuses({
  statuses,
  onStatusesChange,
  onBack,
  onNext,
}: StepStatusesProps) {
  function handleLabelChange(index: number, label: string) {
    const updated = statuses.map((s, i) => (i === index ? { ...s, label } : s))
    onStatusesChange(updated)
  }

  function handleInCareChange(index: number, countsAsInCare: boolean) {
    const updated = statuses.map((s, i) => (i === index ? { ...s, countsAsInCare } : s))
    onStatusesChange(updated)
  }

  function handleMoveUp(index: number) {
    if (index <= 0) return
    const next = [...statuses]
    const temp = next[index - 1]!
    next[index - 1] = next[index]!
    next[index] = temp
    onStatusesChange(next)
  }

  function handleMoveDown(index: number) {
    if (index >= statuses.length - 1) return
    const next = [...statuses]
    const temp = next[index + 1]!
    next[index + 1] = next[index]!
    next[index] = temp
    onStatusesChange(next)
  }

  function handleAddStatus() {
    onStatusesChange([...statuses, { label: '', countsAsInCare: true }])
  }

  function handleRemoveStatus(index: number) {
    if (statuses.length <= 1) return
    onStatusesChange(statuses.filter((_, i) => i !== index))
  }

  const hasValidStatus = statuses.some((s) => s.label.trim().length > 0)

  return (
    <div className="onboarding-step stack">
      <div className="onboarding-step__header">
        <h2>Animal statuses</h2>
        <p className="muted">
          Review and customize your shelter’s animal care stages. Mark stages as “In care” if animals in that stage should count toward your active animal census.
        </p>
      </div>

      <div className="stack onboarding-list" style={{ gap: '0.75rem' }}>
        {statuses.map((status, index) => {
          const isFirst = index === 0
          const isLast = index === statuses.length - 1
          return (
            <div
              key={status.id ?? `status-${index}`}
              className="onboarding-list-item"
            >
              <div className="onboarding-reorder-group" aria-label="Reorder">
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Move up ${status.label || index + 1}`}
                  disabled={isFirst}
                  onClick={() => handleMoveUp(index)}
                >
                  <CaretUp size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Move down ${status.label || index + 1}`}
                  disabled={isLast}
                  onClick={() => handleMoveDown(index)}
                >
                  <CaretDown size={16} weight="bold" />
                </button>
              </div>

              <input
                type="text"
                value={status.label}
                onChange={(e) => handleLabelChange(index, e.target.value)}
                placeholder="Status name"
                aria-label="Status name"
                className="onboarding-item-input"
              />

              <div className="onboarding-select-wrapper">
                <SelectField
                  label="In care status"
                  hideLabel
                  value={status.countsAsInCare ? '1' : '0'}
                  options={[
                    { value: '1', label: 'In care' },
                    { value: '0', label: 'Not in care' },
                  ]}
                  onChange={(val) => handleInCareChange(index, val === '1')}
                />
              </div>

              <Button
                type="button"
                variant="danger-ghost"
                aria-label={`Remove status ${status.label || index + 1}`}
                disabled={statuses.length <= 1}
                onClick={() => handleRemoveStatus(index)}
              >
                <Trash size={16} weight="bold" aria-hidden />
              </Button>
            </div>
          )
        })}
      </div>

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleAddStatus}
        >
          <Plus size={16} weight="bold" aria-hidden /> Add status
        </Button>
      </div>

      <div className="onboarding-actions-row">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onNext}
          disabled={!hasValidStatus}
        >
          Continue to ledger categories →
        </Button>
      </div>
    </div>
  )
}
