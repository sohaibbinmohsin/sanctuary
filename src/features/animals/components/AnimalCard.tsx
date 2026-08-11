import { Link } from 'react-router-dom'
import { SealCheck } from '@phosphor-icons/react'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

type AnimalCardProps = {
  animal: AnimalWithStatus
  photoUrl?: string | null
  /** True when at least one photo was taken with a verified camera session. */
  hasVerifiedPhoto?: boolean
}

export function AnimalCard({
  animal,
  photoUrl,
  hasVerifiedPhoto = false,
}: AnimalCardProps) {
  return (
    <Link className="animal-card" to={`/animals/${animal.id}`}>
      <div
        className="animal-card__photo"
        style={
          photoUrl
            ? {
                backgroundImage: `url(${photoUrl})`,
              }
            : undefined
        }
        role={photoUrl ? 'img' : undefined}
        aria-label={photoUrl ? `Photo of ${animal.name || animal.shelter_code}` : undefined}
      >
        {photoUrl ? null : 'No photo yet'}
        {hasVerifiedPhoto ? (
          <span
            className="animal-card__verified"
            title="Has a verified camera photo"
            aria-label="Has a verified camera photo"
          >
            <SealCheck size={14} weight="fill" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="animal-card__body">
        <div
          className={
            animal.name?.trim()
              ? 'animal-card__name'
              : 'animal-card__code shelter-code'
          }
        >
          {animal.name?.trim() || animal.shelter_code}
        </div>
        {animal.status_label ? (
          <StatusBadge label={animal.status_label} />
        ) : null}
      </div>
    </Link>
  )
}
