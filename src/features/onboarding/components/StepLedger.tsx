import { Plus, Trash } from '@phosphor-icons/react'
import type { CategoryDraft } from '@/features/onboarding/domain/onboarding'
import type { LedgerDirection } from '@/features/ledger/domain/ledger'
import { Button } from '@/shared/ui/Button'
import { SelectField } from '@/shared/ui/SelectField'

export type StepLedgerProps = {
  categories: CategoryDraft[]
  onCategoriesChange: (categories: CategoryDraft[]) => void
  onBack: () => void
  onFinish: () => void
  busy?: boolean
  error?: string | null
}

export function StepLedger({
  categories,
  onCategoriesChange,
  onBack,
  onFinish,
  busy = false,
  error = null,
}: StepLedgerProps) {
  function handleLabelChange(index: number, label: string) {
    const updated = categories.map((c, i) => (i === index ? { ...c, label } : c))
    onCategoriesChange(updated)
  }

  function handleDirectionChange(index: number, direction: LedgerDirection) {
    const updated = categories.map((c, i) => (i === index ? { ...c, direction } : c))
    onCategoriesChange(updated)
  }

  function handleAddCategory() {
    onCategoriesChange([...categories, { label: '', direction: 'out' }])
  }

  function handleRemoveCategory(index: number) {
    if (categories.length <= 1) return
    onCategoriesChange(categories.filter((_, i) => i !== index))
  }

  const hasValidCategory = categories.some((c) => c.label.trim().length > 0)

  return (
    <div className="onboarding-step stack">
      <div className="onboarding-step__header">
        <h2>Ledger categories</h2>
        <p className="muted">
          Review and customize your shelter’s income and expense categories. These help keep your financial ledger organized from day one.
        </p>
      </div>

      {error ? (
        <div className="form-error-banner" role="alert">
          <p className="form-error" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      ) : null}

      <div className="stack onboarding-list" style={{ gap: '0.75rem' }}>
        {categories.map((category, index) => (
          <div
            key={category.id ?? `category-${index}`}
            className="onboarding-list-item"
          >
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
              aria-label={`Remove category ${category.label || index + 1}`}
              disabled={categories.length <= 1}
              onClick={() => handleRemoveCategory(index)}
            >
              <Trash size={16} weight="bold" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleAddCategory}
          disabled={busy}
        >
          <Plus size={16} weight="bold" aria-hidden /> Add category
        </Button>
      </div>

      <div className="onboarding-actions-row">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={busy}
        >
          ← Back
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
