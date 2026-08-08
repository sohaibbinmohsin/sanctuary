import { useEffect, useId, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'

export type FilterMenuOption = {
  value: string
  label: string
}

type FilterMenuProps = {
  label: string
  value: string
  options: FilterMenuOption[]
  /** Shown on the pill when value is empty / “all”. */
  allLabel?: string
  onChange: (value: string) => void
}

/** Chip-style filter that opens a dropdown list (status, type, gender, etc.). */
export function FilterMenu({
  label,
  value,
  options,
  allLabel = 'All',
  onChange,
}: FilterMenuProps) {
  const genId = useId()
  const listId = `${genId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const active = Boolean(value)
  const triggerLabel = selected
    ? `${label} · ${selected.label}`
    : `${label}: ${allLabel}`

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="filter-menu" ref={rootRef}>
      <button
        type="button"
        className={active ? 'chip chip--menu chip--active' : 'chip chip--menu'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Filter by ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{triggerLabel}</span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden
          className={
            open ? 'filter-menu__caret filter-menu__caret--open' : 'filter-menu__caret'
          }
        />
      </button>
      {open ? (
        <ul id={listId} className="filter-menu__panel" role="listbox" aria-label={label}>
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={
                !value
                  ? 'filter-menu__option filter-menu__option--selected'
                  : 'filter-menu__option'
              }
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              <span>{allLabel}</span>
              {!value ? <Check size={16} weight="bold" aria-hidden /> : null}
            </button>
          </li>
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={
                    isSelected
                      ? 'filter-menu__option filter-menu__option--selected'
                      : 'filter-menu__option'
                  }
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected ? (
                    <Check size={16} weight="bold" aria-hidden />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
