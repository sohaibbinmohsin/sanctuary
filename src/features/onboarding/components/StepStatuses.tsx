import { Plus, Trash } from '@phosphor-icons/react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { StatusDraft } from '@/features/onboarding/domain/onboarding'
import { Button } from '@/shared/ui/Button'
import { SelectField } from '@/shared/ui/SelectField'
import { SortableListItem } from './SortableListItem'

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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleLabelChange(index: number, label: string) {
    const updated = statuses.map((s, i) => (i === index ? { ...s, label } : s))
    onStatusesChange(updated)
  }

  function handleInCareChange(index: number, countsAsInCare: boolean) {
    const updated = statuses.map((s, i) => (i === index ? { ...s, countsAsInCare } : s))
    onStatusesChange(updated)
  }

  function handleAddStatus() {
    onStatusesChange([...statuses, { id: crypto.randomUUID(), label: '', countsAsInCare: true }])
  }

  function handleRemoveStatus(index: number) {
    if (statuses.length <= 1) return
    onStatusesChange(statuses.filter((_, i) => i !== index))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = statuses.findIndex((s) => s.id === active.id)
      const newIndex = statuses.findIndex((s) => s.id === over.id)
      onStatusesChange(arrayMove(statuses, oldIndex, newIndex))
    }
  }

  const hasValidStatus = statuses.some((s) => s.label.trim().length > 0)

  return (
    <div className="onboarding-step stack">
      <div className="onboarding-step__header">
        <h2>Animal statuses</h2>
        <p className="muted">
          What stages do animals go through at your shelter? Add them below. Check "In care" if the animal is physically staying with you during that stage.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="stack onboarding-list" style={{ gap: '0.75rem' }}>
          <SortableContext
            items={statuses.map((s, i) => s.id ?? s.label ?? `status-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            {statuses.map((status, index) => {
              const itemId = status.id ?? status.label ?? `status-${index}`
              return (
                <SortableListItem key={itemId} id={itemId}>
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
                  className="onboarding-item-remove-btn"
                  aria-label={`Remove status ${status.label || index + 1}`}
                  disabled={statuses.length <= 1}
                  onClick={() => handleRemoveStatus(index)}
                >
                  <Trash size={16} weight="bold" aria-hidden />
                </Button>
                </SortableListItem>
              )
            })}
          </SortableContext>
        </div>
      </DndContext>

      <div>
        <Button
          type="button"
          variant="secondary"
          className="onboarding-btn-add"
          onClick={handleAddStatus}
        >
          <Plus size={16} weight="bold" aria-hidden /> Add new status
        </Button>
      </div>

      <div className="onboarding-actions-row">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onNext}
          disabled={!hasValidStatus}
        >
          Continue to ledger categories
        </Button>
      </div>
    </div>
  )
}
