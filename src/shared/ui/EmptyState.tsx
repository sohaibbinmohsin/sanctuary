import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  body: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
  actionDisabled?: boolean
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionTo,
  onAction,
  actionDisabled = false,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && actionTo ? (
        actionDisabled ? (
          <Button type="button" variant="accent" disabled>
            {actionLabel}
          </Button>
        ) : (
          <Button to={actionTo} variant="accent">
            {actionLabel}
          </Button>
        )
      ) : null}
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="accent"
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
