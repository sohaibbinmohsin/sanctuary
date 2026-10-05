import { Link } from 'react-router-dom'
import { SealCheck } from '@phosphor-icons/react'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

type AnimalCardProps = {
  animal: AnimalWithStatus
  photoUrl?: string | null
  /** True when at least one photo was taken with a verified camera session. */
  hasVerifiedPhoto?: boolean
  variant?: 'grid' | 'list'
}

export function AnimalCard({
  animal,
  photoUrl,
  hasVerifiedPhoto = false,
  variant = 'grid',
}: AnimalCardProps) {
  const primaryStatus = animal.status_label || animal.status_labels?.[0]
  const isList = variant === 'list'

  if (isList) {
    return (
      <Link className="animal-card animal-card--list" to={`/animals/${animal.id}`}>
        <div
          className="animal-card__photo"
          style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
          role={photoUrl ? 'img' : undefined}
          aria-label={photoUrl ? `Photo of ${animal.name || animal.shelter_code}` : undefined}
        >
          {photoUrl ? null : <span className="animal-card__photo-empty">No photo</span>}
          {hasVerifiedPhoto ? (
            <span className="animal-card__verified" title="Has a verified camera photo">
              <SealCheck size={14} weight="fill" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="animal-card__body">
          <div className={animal.name?.trim() ? 'animal-card__name' : 'animal-card__code shelter-code'}>
            {animal.name?.trim() || animal.shelter_code}
          </div>
          {animal.name?.trim() ? (
            <div className="animal-card__code shelter-code">{animal.shelter_code}</div>
          ) : null}
          {primaryStatus ? (
            <div className="status-badge-row">
              <StatusBadge label={primaryStatus} />
            </div>
          ) : null}
        </div>
      </Link>
    )
  }

  return (
    <Link
      className={`animal-card animal-card--full-bleed${!photoUrl ? ' animal-card--no-photo' : ''}`}
      to={`/animals/${animal.id}`}
      style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
      role="img"
      aria-label={`Photo card for ${animal.name || animal.shelter_code}`}
    >
      <div className="animal-card__overlay-top">
        {primaryStatus ? <StatusBadge label={primaryStatus} /> : <span />}
        {hasVerifiedPhoto ? (
          <span className="animal-card__verified-badge" title="Verified photo">
            <SealCheck size={14} weight="fill" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="animal-card__overlay-bottom">
        <span className="animal-card__overlay-title">
          {animal.name?.trim() || animal.shelter_code}
        </span>
        {animal.name?.trim() ? (
          <span className="animal-card__overlay-sub shelter-code">{animal.shelter_code}</span>
        ) : null}
      </div>
    </Link>
  )
}
