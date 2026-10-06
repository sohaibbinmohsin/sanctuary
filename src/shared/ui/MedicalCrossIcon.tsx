import type { SVGProps } from 'react'

export type MedicalCrossIconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

export function MedicalCrossIcon({
  size = 20,
  className,
  ...props
}: MedicalCrossIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M8.5 2.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-6v6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6h-6a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h6v-6z" />
    </svg>
  )
}
