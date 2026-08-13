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
}

export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <header className="page-header">
      {backTo ? (
        <Link className="back-link" to={backTo}>
          <ArrowLeft size={18} weight="bold" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <div className="page-header__main">
        <div className="page-header__copy">
          <h1>{title}</h1>
          {subtitle ? <p className="page-header__sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
    </header>
  )
}
