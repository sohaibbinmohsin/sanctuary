import type { InputHTMLAttributes } from 'react'
import { Check } from '@phosphor-icons/react'

type CheckMarkProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'className'
> & {
  className?: string
}

/** Custom forest checkbox with a Phosphor check (native input stays for a11y). */
export function CheckMark({ className, ...rest }: CheckMarkProps) {
  return (
    <span className={`check-mark${className ? ` ${className}` : ''}`}>
      <input className="check-mark__input" type="checkbox" {...rest} />
      <span className="check-mark__box" aria-hidden>
        <Check className="check-mark__icon" size={14} weight="bold" />
      </span>
    </span>
  )
}
