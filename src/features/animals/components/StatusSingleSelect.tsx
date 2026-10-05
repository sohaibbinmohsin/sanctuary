import type { AnimalStatus } from '@/features/statuses/domain/statuses'
import { Plus } from '@phosphor-icons/react'

type StatusSingleSelectProps = {
  statuses: AnimalStatus[]
  value: string | null
  onChange: (statusId: string) => void
  onAddStatus?: () => void
  disabled?: boolean
}

export function StatusSingleSelect({
  statuses,
  value,
  onChange,
  onAddStatus,
  disabled = false,
}: StatusSingleSelectProps) {
  const activeStatuses = statuses.filter((s) => s.archived === 0)

  return (
    <div className="status-single-select" role="group" aria-label="Animal status">
      <div className="status-pill-list">
        {activeStatuses.map((status) => {
          const selected = status.id === value
          return (
            <button
              key={status.id}
              type="button"
              className={`status-pill${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(status.id)}
              disabled={disabled}
              aria-pressed={selected}
            >
              {status.label}
            </button>
          )
        })}
        {onAddStatus ? (
          <button
            type="button"
            className="status-pill status-pill--add"
            onClick={onAddStatus}
            disabled={disabled}
            aria-label="Add new status"
          >
            <Plus size={14} weight="bold" /> Add
          </button>
        ) : null}
      </div>
    </div>
  )
}
