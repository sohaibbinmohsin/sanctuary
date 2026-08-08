import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  body: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionTo,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && actionTo ? (
        <Button to={actionTo} variant="accent">
          {actionLabel}
        </Button>
      ) : null}
      {actionLabel && onAction ? (
        <Button type="button" variant="accent" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
