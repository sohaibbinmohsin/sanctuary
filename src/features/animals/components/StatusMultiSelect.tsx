import type { AnimalStatus } from '@/features/statuses/domain/statuses'

type StatusMultiSelectProps = {
  statuses: AnimalStatus[]
  value: string[]
  onChange: (ids: string[]) => void
  onRequestExit?: (exitId: string, nextIds: string[]) => void
}

export function StatusMultiSelect({
  statuses,
  value,
  onChange,
  onRequestExit,
}: StatusMultiSelectProps) {
  const availableStatuses = statuses.filter((status) => status.archived === 0)

  function toggle(status: AnimalStatus) {
    const selected = value.includes(status.id)

    if (selected) {
      if (value.length === 1) return
      onChange(value.filter((id) => id !== status.id))
      return
    }

    const nextIds =
      status.counts_as_in_care === 1
        ? [
            ...value.filter((id) => {
              const selectedStatus = statuses.find((item) => item.id === id)
              return selectedStatus?.counts_as_in_care !== 0
            }),
            status.id,
          ]
        : [...value, status.id]
    if (status.counts_as_in_care === 0 && onRequestExit) {
      onRequestExit(status.id, nextIds)
      return
    }
    onChange(nextIds)
  }

  return (
    <fieldset className="status-multi-select">
      <legend>Status</legend>
      <div
        className="status-multi-select__options"
        role="group"
        aria-label="Status"
      >
        {availableStatuses.map((status) => {
          const selected = value.includes(status.id)
          const isOnlySelection = selected && value.length === 1
          return (
            <label
              key={status.id}
              className="status-multi-select__option"
              data-selected={selected || undefined}
              data-disabled={isOnlySelection || undefined}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={isOnlySelection}
                onChange={() => toggle(status)}
              />
              <span>{status.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
