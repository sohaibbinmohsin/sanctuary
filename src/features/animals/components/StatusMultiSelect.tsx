import { useEffect, useId, useRef, useState } from 'react'
import { Check, Plus, X } from '@phosphor-icons/react'
import type { AnimalStatus } from '@/features/statuses/domain/statuses'

type StatusMultiSelectProps = {
  statuses: AnimalStatus[]
  value: string[]
  onChange: (ids: string[]) => void
  onRequestExit?: (exitId: string, nextIds: string[]) => void
}

function idsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const set = new Set(b)
  return a.every((id) => set.has(id))
}

function nextIdsAfterAdd(
  statuses: AnimalStatus[],
  current: string[],
  status: AnimalStatus,
): string[] {
  if (status.counts_as_in_care === 1) {
    return [
      ...current.filter((id) => {
        const selectedStatus = statuses.find((item) => item.id === id)
        return selectedStatus?.counts_as_in_care !== 0
      }),
      status.id,
    ]
  }
  return [...current, status.id]
}

export function StatusMultiSelect({
  statuses,
  value,
  onChange,
  onRequestExit,
}: StatusMultiSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(value)
  const draftRef = useRef(draft)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onRequestExitRef = useRef(onRequestExit)
  const statusesRef = useRef(statuses)

  draftRef.current = draft
  valueRef.current = value
  onChangeRef.current = onChange
  onRequestExitRef.current = onRequestExit
  statusesRef.current = statuses

  const availableStatuses = statuses.filter((status) => status.archived === 0)
  const selectedStatuses = value
    .map((id) => availableStatuses.find((status) => status.id === id))
    .filter((status): status is AnimalStatus => Boolean(status))
  const canAdd = availableStatuses.some((status) => !value.includes(status.id))

  function applyDraft(nextDraft: string[]) {
    setOpen(false)
    if (nextDraft.length === 0) return

    const currentValue = valueRef.current
    const addedExitId = nextDraft.find((id) => {
      if (currentValue.includes(id)) return false
      const status = statusesRef.current.find((item) => item.id === id)
      return status?.counts_as_in_care === 0
    })

    if (addedExitId && onRequestExitRef.current) {
      onRequestExitRef.current(addedExitId, nextDraft)
      return
    }

    if (!idsEqual(nextDraft, currentValue)) {
      onChangeRef.current(nextDraft)
    }
  }

  function openPicker() {
    setDraft(value)
    setOpen(true)
  }

  function closeAndApply() {
    applyDraft(draftRef.current)
  }

  function closeAndDiscard() {
    setOpen(false)
    setDraft(valueRef.current)
  }

  function remove(statusId: string) {
    if (value.length === 1) return
    onChange(value.filter((id) => id !== statusId))
  }

  function toggleDraft(status: AnimalStatus) {
    setDraft((current) => {
      const selected = current.includes(status.id)
      if (selected) {
        if (current.length === 1) return current
        return current.filter((id) => id !== status.id)
      }
      return nextIdsAfterAdd(statuses, current, status)
    })
  }

  useEffect(() => {
    if (!open) return

    function onPointer(e: MouseEvent) {
      const target = e.target as Node
      // Ignore clicks inside the picker (Add control + panel).
      if (rootRef.current?.contains(target)) return
      closeAndDiscard()
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeAndDiscard()
      }
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <fieldset className="status-multi-select status-multi-select--tags">
      <legend>Status</legend>
      <div
        className="status-multi-select__tags"
        role="group"
        aria-label="Status"
      >
        {selectedStatuses.map((status) => {
          const isOnlySelection = value.length === 1
          return (
            <span
              key={status.id}
              className="status-multi-select__tag"
              data-disabled={isOnlySelection || undefined}
            >
              <span className="status-multi-select__tag-label">
                {status.label}
              </span>
              <button
                type="button"
                className="status-multi-select__tag-remove"
                aria-label={`Remove ${status.label}`}
                disabled={isOnlySelection}
                onClick={() => remove(status.id)}
              >
                <X size={12} weight="bold" aria-hidden />
              </button>
            </span>
          )
        })}

        {canAdd ? (
          <div className="status-multi-select__add-wrap" ref={rootRef}>
            <button
              type="button"
              className="status-multi-select__add"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              onClick={() => (open ? closeAndApply() : openPicker())}
            >
              <Plus size={14} weight="bold" aria-hidden />
              <span>Add</span>
            </button>

            {open ? (
              <div
                id={listId}
                className="status-multi-select__panel"
                role="listbox"
                aria-multiselectable="true"
                aria-label="Add status"
              >
                <ul className="status-multi-select__panel-list">
                  {availableStatuses.map((status) => {
                    const selected = draft.includes(status.id)
                    const isOnlySelection = selected && draft.length === 1
                    return (
                      <li key={status.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={isOnlySelection}
                          className={
                            selected
                              ? 'status-multi-select__panel-option status-multi-select__panel-option--selected'
                              : 'status-multi-select__panel-option'
                          }
                          onClick={() => toggleDraft(status)}
                        >
                          <span>{status.label}</span>
                          {selected ? (
                            <Check size={16} weight="bold" aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="status-multi-select__panel-actions">
                  <button
                    type="button"
                    className="status-multi-select__panel-done"
                    onClick={closeAndApply}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </fieldset>
  )
}
