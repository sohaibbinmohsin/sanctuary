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
import type { CategoryDraft } from '@/features/onboarding/domain/onboarding'
import type { CurrencyCode, LedgerDirection } from '@/features/ledger/domain/ledger'
import { Button } from '@/shared/ui/Button'
import { SelectField } from '@/shared/ui/SelectField'
import { SortableListItem } from './SortableListItem'

export type StepLedgerProps = {
  currency?: CurrencyCode
  onCurrencyChange?: (currency: CurrencyCode) => void
  categories: CategoryDraft[]
  onCategoriesChange: (categories: CategoryDraft[]) => void
  onBack: () => void
  onFinish: () => void
  busy?: boolean
  error?: string | null
}

export function StepLedger({
  currency = 'PKR',
  onCurrencyChange,
  categories,
  onCategoriesChange,
  onBack,
  onFinish,
  busy = false,
  error = null,
}: StepLedgerProps) {
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
    const updated = categories.map((c, i) => (i === index ? { ...c, label } : c))
    onCategoriesChange(updated)
  }

  function handleDirectionChange(index: number, direction: LedgerDirection) {
    const updated = categories.map((c, i) => (i === index ? { ...c, direction } : c))
    onCategoriesChange(updated)
  }

  function handleAddCategory() {
    onCategoriesChange([...categories, { id: crypto.randomUUID(), label: '', direction: 'out' }])
  }

  function handleRemoveCategory(index: number) {
    if (categories.length <= 1) return
    onCategoriesChange(categories.filter((_, i) => i !== index))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id)
      const newIndex = categories.findIndex((c) => c.id === over.id)
      onCategoriesChange(arrayMove(categories, oldIndex, newIndex))
    }
  }

  const hasValidCategory = categories.some((c) => c.label.trim().length > 0)

  return (
    <div className="onboarding-step stack">
      <div className="onboarding-step__header">
        <h2>Ledger & currency</h2>
        <p className="muted">
          Choose your default currency and categorize where your money comes from (Money in) and where it goes (Money out).
        </p>
      </div>

      <div>
        <SelectField
          label="Default currency"
          hint="Used across ledger and overview"
          value={currency}
          options={[
            { value: 'PKR', label: 'Pakistani Rupee' },
            { value: 'USD', label: 'US Dollar' },
          ]}
          onChange={(val) => onCurrencyChange?.(val as CurrencyCode)}
        />
      </div>

      {error ? (
        <div className="form-error-banner" role="alert">
          <p className="form-error" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      ) : null}

      <div className="stack" style={{ gap: '0.5rem' }}>
        <label className="field__label" style={{ margin: 0 }}>
          Categories
          <span className="field__hint"> · Track money in and out</span>
        </label>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="stack onboarding-list" style={{ gap: '0.75rem' }}>
            <SortableContext
              items={categories.map((c, i) => c.id ?? c.label ?? `cat-${i}`)}
              strategy={verticalListSortingStrategy}
            >
            {categories.map((category, index) => {
              const itemId = category.id ?? category.label ?? `cat-${index}`
              return (
                <SortableListItem key={itemId} id={itemId}>
                <input
                  type="text"
                  value={category.label}
                  onChange={(e) => handleLabelChange(index, e.target.value)}
                  placeholder="Category name"
                  aria-label="Category name"
                  className="onboarding-item-input"
                />

                <div className="onboarding-select-wrapper">
                  <SelectField
                    label="Direction"
                    hideLabel
                    value={category.direction}
                    options={[
                      { value: 'in', label: 'Money in' },
                      { value: 'out', label: 'Money out' },
                    ]}
                    onChange={(val) =>
                      handleDirectionChange(index, val as LedgerDirection)
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="danger-ghost"
                  className="onboarding-item-remove-btn"
                  aria-label={`Remove category ${category.label || index + 1}`}
                  disabled={categories.length <= 1}
                  onClick={() => handleRemoveCategory(index)}
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
          onClick={handleAddCategory}
          disabled={busy}
        >
          <Plus size={16} weight="bold" aria-hidden /> Add new category
        </Button>
      </div>
      </div>

      <div className="onboarding-actions-row">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={busy}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onFinish}
          disabled={busy || !hasValidCategory}
        >
          {busy ? 'Finishing setup…' : 'Finish setup'}
        </Button>
      </div>
    </div>
  )
}
