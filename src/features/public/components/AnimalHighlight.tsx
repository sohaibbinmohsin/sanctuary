import { useEffect, useId, useRef, useState } from 'react'
import { CaretLeft, CaretRight, PawPrint, SealCheck, X } from '@phosphor-icons/react'
import { VerifiedPhotoBadge } from '@/features/public/components/VerifiedPhotoBadge'
import type { PublicAnimalDto } from '@/shared/lib/public/visibility'

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type AnimalHighlightProps = {
  animal: PublicAnimalDto
  onClose: () => void
  onExplainVerified: () => void
}

/**
 * In-page highlight for an animal: photo stage, details, and care log.
 */
export function AnimalHighlight({
  animal,
  onClose,
  onExplainVerified,
}: AnimalHighlightProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const [photoIndex, setPhotoIndex] = useState(0)

  const displayName = animal.name ?? animal.shelterCode
  const hasVerified = animal.photos.some((p) => p.verified)
  const photos = animal.photos
  const photo = photos[photoIndex] ?? null
  const detailBits = [animal.species, animal.sex, animal.statusLabel].filter(
    Boolean,
  )

  onCloseRef.current = onClose

  useEffect(() => {
    setPhotoIndex(0)
  }, [animal.id])

  useEffect(() => {
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (photos.length <= 1) return
      if (e.key === 'ArrowLeft') {
        setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)
      }
      if (e.key === 'ArrowRight') {
        setPhotoIndex((i) => (i + 1) % photos.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [photos.length])

  return (
    <div
      className="ps-highlight"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => onCloseRef.current()}
    >
      <div
        className="ps-highlight__frame ps-highlight__frame--animal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ps-animal-highlight__header">
          <div className="ps-animal-highlight__heading">
            <div className="ps-animal-highlight__title-row">
              <h2 id={titleId} className="ps-animal-highlight__name">
                {displayName}
              </h2>
              {hasVerified ? (
                <button
                  type="button"
                  className="public-shelter__verified-tick"
                  aria-label="What verified means"
                  onClick={onExplainVerified}
                >
                  <SealCheck size={16} weight="fill" aria-hidden />
                </button>
              ) : null}
            </div>
            <p className="ps-animal-highlight__code">{animal.shelterCode}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ps-highlight__icon-btn"
            aria-label="Close"
            onClick={() => onCloseRef.current()}
          >
            <X size={22} weight="bold" aria-hidden />
          </button>
        </header>

        <div className="ps-animal-highlight__scroll">
          <div className="ps-animal-highlight__stage">
            {photos.length > 1 ? (
              <button
                type="button"
                className="ps-highlight__nav ps-highlight__nav--prev"
                aria-label="Previous photo"
                onClick={() =>
                  setPhotoIndex(
                    (i) => (i - 1 + photos.length) % photos.length,
                  )
                }
              >
                <CaretLeft size={24} weight="bold" aria-hidden />
              </button>
            ) : null}

            {photo ? (
              <div className="ps-animal-highlight__photo-wrap">
                <img
                  className="ps-animal-highlight__photo"
                  src={photo.url}
                  alt={`${displayName} photo ${photoIndex + 1}`}
                />
                <VerifiedPhotoBadge verified={photo.verified} />
                {photos.length > 1 ? (
                  <span className="ps-animal-highlight__photo-count">
                    {photoIndex + 1} / {photos.length}
                  </span>
                ) : null}
              </div>
            ) : (
              <div
                className="ps-animal-highlight__photo ps-animal-highlight__photo--empty"
                aria-hidden
              >
                <PawPrint size={40} weight="duotone" />
              </div>
            )}

            {photos.length > 1 ? (
              <button
                type="button"
                className="ps-highlight__nav ps-highlight__nav--next"
                aria-label="Next photo"
                onClick={() =>
                  setPhotoIndex((i) => (i + 1) % photos.length)
                }
              >
                <CaretRight size={24} weight="bold" aria-hidden />
              </button>
            ) : null}
          </div>

          {detailBits.length > 0 ? (
            <section
              className="ps-animal-highlight__section"
              aria-labelledby="animal-details-heading"
            >
              <h3
                id="animal-details-heading"
                className="ps-animal-highlight__section-label"
              >
                Details
              </h3>
              <dl className="ps-animal-highlight__details">
                {animal.species ? (
                  <div>
                    <dt>Species</dt>
                    <dd>{animal.species}</dd>
                  </div>
                ) : null}
                {animal.sex ? (
                  <div>
                    <dt>Sex</dt>
                    <dd>{animal.sex}</dd>
                  </div>
                ) : null}
                {animal.statusLabel ? (
                  <div>
                    <dt>Status</dt>
                    <dd>{animal.statusLabel}</dd>
                  </div>
                ) : null}
                {animal.markings ? (
                  <div>
                    <dt>Markings</dt>
                    <dd>{animal.markings}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section
            className="ps-animal-highlight__section"
            aria-labelledby="animal-care-heading"
          >
            <h3
              id="animal-care-heading"
              className="ps-animal-highlight__section-label"
            >
              Care log
            </h3>
            {animal.care.length > 0 ? (
              <ul className="public-shelter__care public-shelter__care--full">
                {animal.care.map((entry) => (
                  <li key={entry.id}>
                    <span className="public-shelter__care-when">
                      {formatDate(entry.treatedAt)}
                    </span>
                    <span className="public-shelter__care-type">
                      {entry.treatmentType}
                    </span>
                    {entry.notes ? (
                      <span className="public-shelter__care-notes">
                        {entry.notes}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="public-shelter__care-empty">
                No care notes to show yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
