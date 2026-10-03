import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'accent'
  | 'danger'
  | 'danger-ghost'
  | 'danger-outline'

type Common = {
  variant?: Variant
  size?: 'sm' | 'md'
  block?: boolean
  children: ReactNode
  className?: string
}

type ButtonAsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: undefined
  }

type ButtonAsLink = Common &
  Omit<LinkProps, 'className'> & {
    to: string
  }

export type ButtonProps = ButtonAsButton | ButtonAsLink

function classes(variant: Variant, block?: boolean, size?: 'sm' | 'md', className?: string) {
  return [
    'btn',
    `btn--${variant}`,
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const variant = props.variant ?? 'primary'
    const className = classes(variant, props.block, props.size, props.className)

    if ('to' in props && props.to !== undefined) {
      const { variant: _v, block: _b, size: _s, className: _c, children, ...rest } = props
      return (
        <Link className={className} {...rest}>
          {children}
        </Link>
      )
    }

    const {
      variant: _v,
      block: _b,
      size: _s,
      className: _c,
      children,
      type = 'button',
      ...rest
    } = props
    return (
      <button ref={ref} type={type} className={className} {...rest}>
        {children}
      </button>
    )
  },
)
