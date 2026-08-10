import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { fetchPublicShelter } from '@/features/public/api/fetchPublicShelter'
import { VerifiedPhotoBadge } from '@/features/public/components/VerifiedPhotoBadge'
import { isReservedPublicSlug } from '@/shared/lib/public/slug'
import { formatPkr } from '@/features/ledger/domain/ledger'
import type { PublicShelterDto } from '@/shared/lib/public/visibility'
import '@/features/public/public-shelter.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: PublicShelterDto }
  | { status: 'not-found' }
  | { status: 'rate-limited' }
  | { status: 'error' }

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type PublicShelterScreenProps = {
  /** Overrides the `:slug` route param — used where the route isn't `/:slug`. */
  slug?: string
}

export function PublicShelterScreen({ slug: slugProp }: PublicShelterScreenProps = {}) {
  const { slug: slugParam = '' } = useParams<{ slug: string }>()
  const slug = slugProp ?? slugParam
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (isReservedPublicSlug(slug)) return

    let cancelled = false
    setState({ status: 'loading' })

    void (async () => {
      const result = await fetchPublicShelter(slug)
      if (cancelled) return

      if (result.ok) {
        setState({ status: 'ready', data: result.data })
        return
      }

      if (result.status === 429) {
        setState({ status: 'rate-limited' })
        return
      }

      if (result.status === 404) {
        setState({ status: 'not-found' })
        return
      }

      setState({ status: 'error' })
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  if (isReservedPublicSlug(slug)) {
    return <Navigate to="/" replace />
  }

  if (state.status === 'loading') {
    return (
      <div className="public-shelter">
        <div className="public-shelter__state" aria-busy="true" aria-live="polite">
          Loading shelter page…
        </div>
      </div>
    )
  }

  if (state.status === 'rate-limited') {
    return (
      <div className="public-shelter">
        <div className="public-shelter__state" role="alert">
          Too many requests. Try again in a moment.
        </div>
      </div>
    )
  }

  if (state.status === 'not-found' || state.status === 'error') {
    return (
      <div className="public-shelter">
        <div className="public-shelter__state" role="alert">
          This shelter page isn’t available.
        </div>
      </div>
    )
  }

  const { data } = state
  const totalInCents = data.ledger
    .filter((e) => e.direction === 'in')
    .reduce((sum, e) => sum + e.amountCents, 0)
  const totalOutCents = data.ledger
    .filter((e) => e.direction === 'out')
    .reduce((sum, e) => sum + e.amountCents, 0)

  return (
    <div className="public-shelter">
      <header className="public-shelter__hero">
        <h1>{data.orgName}</h1>
        <p>
          An open record of the animals in our care and the donations that support
          them, updated by our team.
        </p>
      </header>

      <div className="public-shelter__wrap">
        <section className="public-shelter__section" aria-labelledby="animals-heading">
          <h2 id="animals-heading">Animals in our care</h2>
          {data.animals.length === 0 ? (
            <p className="public-shelter__state" style={{ padding: 0 }}>
              No animals to show right now.
            </p>
          ) : (
            <div className="public-shelter__animals">
              {data.animals.map((animal) => (
                <article className="public-shelter__animal" key={animal.id}>
                  {animal.photos.length > 0 ? (
                    <div className="public-shelter__animal-photos">
                      {animal.photos.map((photo) => (
                        <div className="public-shelter__photo" key={photo.id}>
                          <img
                            src={photo.url}
                            alt={animal.name ?? animal.shelterCode}
                            loading="lazy"
                          />
                          <VerifiedPhotoBadge verified={photo.verified} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div>
                    <div className="public-shelter__animal-name">
                      {animal.name ?? animal.shelterCode}
                    </div>
                    <div className="public-shelter__animal-meta">
                      {[animal.species, animal.sex, animal.statusLabel]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  {animal.care.length > 0 ? (
                    <ul className="public-shelter__care-list">
                      {animal.care.map((entry) => (
                        <li key={entry.id}>
                          {formatDate(entry.treatedAt)} — {entry.treatmentType}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="public-shelter__section" aria-labelledby="ledger-heading">
          <h2 id="ledger-heading">Money in and out</h2>
          {data.ledger.length === 0 ? (
            <p className="public-shelter__state" style={{ padding: 0 }}>
              No ledger entries to show right now.
            </p>
          ) : (
            <div className="public-shelter__ledger">
              <div className="public-shelter__ledger-totals">
                <div>
                  <span>Money in</span>
                  <span className="public-shelter__ledger-amount--in">
                    {formatPkr(totalInCents)}
                  </span>
                </div>
                <div>
                  <span>Money out</span>
                  <span className="public-shelter__ledger-amount--out">
                    {formatPkr(totalOutCents)}
                  </span>
                </div>
              </div>
              {data.ledger.map((entry) => (
                <div className="public-shelter__ledger-row" key={entry.id}>
                  <div className="public-shelter__ledger-info">
                    <span>
                      {formatDate(entry.entryDate)} · {entry.categoryLabel}
                      {entry.isAnonymous ? ' · Anonymous' : ''}
                    </span>
                    {entry.attachmentUrls.length > 0 ? (
                      <div className="public-shelter__ledger-attachments">
                        {entry.attachmentUrls.map((url, index) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Attachment {index + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={
                      entry.direction === 'in'
                        ? 'public-shelter__ledger-amount--in'
                        : 'public-shelter__ledger-amount--out'
                    }
                  >
                    {entry.direction === 'in' ? '+' : '−'}
                    {formatPkr(entry.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="public-shelter__footer">Powered by Sanctuary</p>
      </div>
    </div>
  )
}
