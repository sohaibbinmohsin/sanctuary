import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { Field } from '@/shared/ui/Field'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectFieldProps = {
  label: string
  hint?: string
  id?: string
  name?: string
  value: string
  options: SelectOption[]
  required?: boolean
  disabled?: boolean
  placeholder?: string
  hideLabel?: boolean
  onChange: (value: string) => void
  className?: string
}

/** Branded listbox select (closed state + open panel match Sanctuary tokens). */
export function SelectField({
  label,
  hint,
  id,
  name,
  value,
  options,
  required,
  disabled,
  placeholder = 'Choose…',
  hideLabel,
  onChange,
  className,
}: SelectFieldProps) {
  const genId = useId()
  const fieldId = id ?? name ?? genId
  const listId = `${fieldId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

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
    <div
      className={['field', 'select-field', className].filter(Boolean).join(' ')}
      ref={rootRef}
    >
      <span
        id={`${fieldId}-label`}
        className={hideLabel ? 'sr-only' : 'select-field__label'}
      >
        {label}
        {!hideLabel && hint ? (
          <span className="field__hint"> · {hint}</span>
        ) : null}
      </span>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        type="button"
        id={fieldId}
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${fieldId}-label`}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? undefined : 'select-trigger__placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <CaretDown
          className={open ? 'select-trigger__caret select-trigger__caret--open' : 'select-trigger__caret'}
          size={16}
          weight="bold"
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={listId}
          className="select-menu"
          role="listbox"
          aria-labelledby={`${fieldId}-label`}
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  className={
                    isSelected
                      ? 'select-menu__option select-menu__option--selected'
                      : 'select-menu__option'
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

/** Native select fallback styling wrapper for simple cases still using children. */
export function NativeSelectField({
  label,
  hint,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  children: ReactNode
}) {
  const inputId = id ?? rest.name
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <div className="native-select">
        <select id={inputId} {...rest}>
          {children}
        </select>
        <CaretDown className="native-select__caret" size={16} weight="bold" aria-hidden />
      </div>
    </Field>
  )
}
