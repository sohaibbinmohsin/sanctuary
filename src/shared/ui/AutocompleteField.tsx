import {
  useState,
  useRef,
  useEffect,
  useId,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'

export type AutocompleteFieldProps = {
  label: string
  hint?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  suggestions: readonly string[] | string[]
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export function AutocompleteField({
  label,
  hint,
  placeholder,
  value,
  onChange,
  suggestions,
  required,
  disabled,
  className,
  id,
}: AutocompleteFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const listboxId = `${fieldId}-suggestions`

  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const query = value.trim().toLowerCase()
  const filtered = suggestions
    .filter((item) => (query ? item.toLowerCase().includes(query) : true))
    .slice(0, 30) // Cap dropdown to 30 visible items for snappy rendering

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  function handleSelect(item: string) {
    onChange(item)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filtered[highlightedIndex]) {
        e.preventDefault()
        handleSelect(filtered[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`field stack stack--tight ${className ?? ''}`}
      style={{ position: 'relative' }}
    >
      <label htmlFor={fieldId} className="field__label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          {label}
          {hint && <span className="field__hint"> · {hint}</span>}
        </span>
      </label>

      <div style={{ position: 'relative', width: '100%' }}>
        <input
          id={fieldId}
          type="text"
          className="field__input"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          required={required}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          style={{ width: '100%', boxSizing: 'border-box' }}
        />

        {isOpen && filtered.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              maxHeight: '220px',
              overflowY: 'auto',
              background: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              zIndex: 50,
              margin: 0,
              padding: '4px',
              listStyle: 'none',
              boxSizing: 'border-box',
            }}
          >
            {filtered.map((item, idx) => {
              const isSelected = item.toLowerCase() === value.trim().toLowerCase()
              const isHighlighted = idx === highlightedIndex
              return (
                <li
                  key={item}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault() // Prevents input blur before click triggers
                    handleSelect(item)
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--color-ink)',
                    background: isHighlighted
                      ? 'var(--color-surface-hover, #f3f4f6)'
                      : isSelected
                        ? 'var(--color-brand-soft, #fef3c7)'
                        : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '36px',
                  }}
                >
                  <span>{item}</span>
                  {isSelected && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-forest)', fontWeight: 600 }}>
                      Selected
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
