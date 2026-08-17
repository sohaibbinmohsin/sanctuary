import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'

type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** When set, shows a back control above the title. */
  backTo?: string
  backLabel?: string
  /** Hide the back control at the desktop sidebar breakpoint. */
  hideBackOnDesktop?: boolean
  /** Sit actions on the back-link row on mobile. */
  actionsOnBackRow?: boolean
}

export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
  backLabel = 'Back',
  hideBackOnDesktop = false,
  actionsOnBackRow = false,
}: PageHeaderProps) {
  const headerClass =
    actions && actionsOnBackRow
      ? 'page-header page-header--actions-on-back'
      : 'page-header'
  const actionsEl = actions ? (
    <div className="page-header__actions">{actions}</div>
  ) : null

  return (
    <header className={headerClass}>
      {backTo ? (
        <Link
          className={
            hideBackOnDesktop
              ? 'back-link back-link--desktop-hidden'
              : 'back-link'
          }
          to={backTo}
        >
          <ArrowLeft size={18} weight="bold" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <div className="page-header__main">
        <div className="page-header__copy">
          <h1>{title}</h1>
          {subtitle ? <p className="page-header__sub">{subtitle}</p> : null}
        </div>
        {actionsOnBackRow ? null : actionsEl}
      </div>
      {actionsOnBackRow ? actionsEl : null}
    </header>
  )
}
