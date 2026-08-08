import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'

type FieldProps = {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span>
        {label}
        {hint ? <span className="field__hint"> · {hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function TextField({ label, hint, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <input id={inputId} {...rest} />
    </Field>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
}

export function TextareaField({ label, hint, id, ...rest }: TextareaProps) {
  const inputId = id ?? rest.name
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <textarea id={inputId} {...rest} />
    </Field>
  )
}

export { SelectField, NativeSelectField } from '@/shared/ui/SelectField'
export type { SelectOption } from '@/shared/ui/SelectField'
