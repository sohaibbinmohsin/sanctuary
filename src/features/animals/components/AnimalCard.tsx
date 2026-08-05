import { Link } from 'react-router-dom'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

type AnimalCardProps = {
  animal: AnimalWithStatus
  photoUrl?: string | null
}

export function AnimalCard({ animal, photoUrl }: AnimalCardProps) {
  return (
    <Link className="animal-card" to={`/animals/${animal.id}`}>
      <div
        className="animal-card__photo"
        style={
          photoUrl
            ? {
                backgroundImage: `url(${photoUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {photoUrl ? null : 'Photo'}
      </div>
      <div className="animal-card__body">
        <div className="animal-card__code">{animal.shelter_code}</div>
        <div>{animal.name || animal.species}</div>
        {animal.status_label ? (
          <StatusBadge label={animal.status_label} />
        ) : null}
      </div>
    </Link>
  )
}
