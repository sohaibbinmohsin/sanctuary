import { Link } from 'react-router-dom'
import { SealCheck } from '@phosphor-icons/react'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { AnimalLineArt } from '@/features/animals/components/AnimalLineArt'

export type AnimalCardData = {
  id: string
  shelter_code?: string | null
  shelterCode?: string | null
  name?: string | null
  species?: string | null
  life_stage?: 'adult' | 'child' | null
  lifeStage?: 'adult' | 'child' | null
  status_label?: string | null
  statusLabel?: string | null
  status_labels?: string[]
  statusTone?: 'default' | 'amber' | 'muted' | 'forest' | null
  primaryPhotoUrl?: string | null
  primary_photo_url?: string | null
  notes?: string | null
  [key: string]: unknown
}

type AnimalCardProps = {
  animal: AnimalCardData
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
  const primaryStatus =
    animal.status_label ||
    animal.statusLabel ||
    animal.status_labels?.[0]
  const isList = variant === 'list'
  const shelterCode = animal.shelter_code || animal.shelterCode || ''
  const name = animal.name?.trim() || ''
  const displayName = name || shelterCode
  const lifeStage = animal.lifeStage || animal.life_stage || null
  const resolvedPhotoUrl =
    photoUrl ?? animal.primaryPhotoUrl ?? animal.primary_photo_url ?? null

  if (isList) {
    return (
      <Link className="animal-card animal-card--list" to={`/animals/${animal.id}`}>
        <div
          className="animal-card__photo"
          style={resolvedPhotoUrl ? { backgroundImage: `url(${resolvedPhotoUrl})` } : undefined}
          role={resolvedPhotoUrl ? 'img' : undefined}
          aria-label={resolvedPhotoUrl ? `Photo of ${displayName}` : undefined}
        >
          {resolvedPhotoUrl ? null : (
            <AnimalLineArt
              species={animal.species}
              lifeStage={lifeStage}
              aspectRatio="square"
            />
          )}
          {hasVerifiedPhoto ? (
            <span className="animal-card__verified" title="Has a verified camera photo">
              <SealCheck size={14} weight="fill" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="animal-card__body">
          <div className={name ? 'animal-card__name' : 'animal-card__code shelter-code'}>
            {displayName}
          </div>
          {name && shelterCode ? (
            <div className="animal-card__code shelter-code">{shelterCode}</div>
          ) : null}
          {primaryStatus ? (
            <div className="status-badge-row">
              <StatusBadge label={primaryStatus} tone={animal.statusTone || undefined} />
            </div>
          ) : null}
        </div>
      </Link>
    )
  }

  return (
    <Link
      className={`animal-card animal-card--full-bleed${!resolvedPhotoUrl ? ' animal-card--no-photo' : ''}`}
      to={`/animals/${animal.id}`}
      style={resolvedPhotoUrl ? { backgroundImage: `url(${resolvedPhotoUrl})` } : undefined}
      role="img"
      aria-label={`Photo card for ${displayName}`}
    >
      {!resolvedPhotoUrl ? (
        <AnimalLineArt
          species={animal.species}
          lifeStage={lifeStage}
          aspectRatio="cover"
          className="animal-card__line-art"
        />
      ) : null}

      <div className="animal-card__overlay-top">
        {primaryStatus ? <StatusBadge label={primaryStatus} tone={animal.statusTone || undefined} /> : <span />}
        {hasVerifiedPhoto ? (
          <span className="animal-card__verified-badge" title="Verified photo">
            <SealCheck size={14} weight="fill" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="animal-card__overlay-bottom">
        <span className="animal-card__overlay-title">{displayName}</span>
        {name && shelterCode ? (
          <span className="animal-card__overlay-sub shelter-code">{shelterCode}</span>
        ) : null}
      </div>
    </Link>
  )
}
