import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  House,
  MagnifyingGlass,
  Paperclip,
  PawPrint,
  SealCheck,
} from '@phosphor-icons/react'
import { fetchPublicShelter } from '@/features/public/api/fetchPublicShelter'
import { AnimalHighlight } from '@/features/public/components/AnimalHighlight'
import {
  MediaHighlight,
  type HighlightItem,
} from '@/features/public/components/MediaHighlight'
import { VerifiedExplainDialog } from '@/features/public/components/VerifiedExplainDialog'
import { isReservedPublicSlug } from '@/shared/lib/public/slug'
import { formatPkr } from '@/features/ledger/domain/ledger'
import { AnimalLoader } from '@/shared/ui/AnimalLoader'
import type {
  PublicAnimalDto,
  PublicLedgerDto,
  PublicShelterDto,
} from '@/shared/lib/public/visibility'
import '@/features/public/public-shelter.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: PublicShelterDto }
  | { status: 'not-found' }
  | { status: 'rate-limited' }
  | { status: 'error' }

type SectionTab = 'animals' | 'ledger'

type HighlightState = {
  items: HighlightItem[]
  index: number
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function animalSearchText(animal: PublicAnimalDto): string {
  return [
    animal.name,
    animal.shelterCode,
    animal.species,
    animal.sex,
    animal.statusLabel,
    animal.markings,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function ledgerSearchText(entry: PublicLedgerDto): string {
  return [
    entry.categoryLabel,
    entry.notes,
    entry.isAnonymous ? 'anonymous' : '',
    entry.direction,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

type PublicShelterScreenProps = {
  /** Overrides the `:slug` route param — used where the route isn't `/:slug`. */
  slug?: string
}

export function PublicShelterScreen({
  slug: slugProp,
}: PublicShelterScreenProps = {}) {
  const { slug: slugParam = '' } = useParams<{ slug: string }>()
  const slug = slugProp ?? slugParam
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<SectionTab>('animals')
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState<HighlightState | null>(null)

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

  const data = state.status === 'ready' ? state.data : null
  const normalizedQuery = query.trim().toLowerCase()

  const animals = useMemo(() => {
    if (!data) return []
    if (!normalizedQuery) return data.animals
    return data.animals.filter((a) =>
      animalSearchText(a).includes(normalizedQuery),
    )
  }, [data, normalizedQuery])

  const ledger = useMemo(() => {
    if (!data) return []
    if (!normalizedQuery) return data.ledger
    return data.ledger.filter((e) =>
      ledgerSearchText(e).includes(normalizedQuery),
    )
  }, [data, normalizedQuery])

  const totalInCents = useMemo(() => {
    if (!data) return 0
    return data.ledger
      .filter((e) => e.direction === 'in')
      .reduce((sum, e) => sum + e.amountCents, 0)
  }, [data])

  const totalOutCents = useMemo(() => {
    if (!data) return 0
    return data.ledger
      .filter((e) => e.direction === 'out')
      .reduce((sum, e) => sum + e.amountCents, 0)
  }, [data])

  if (isReservedPublicSlug(slug)) {
    return <Navigate to="/" replace />
  }

  if (state.status === 'loading') {
    return (
      <div className="public-shelter public-shelter--loading">
        <AnimalLoader label="Loading shelter page…" />
      </div>
    )
  }

  if (state.status === 'rate-limited') {
    return (
      <div className="public-shelter public-shelter--status">
        <div className="public-shelter__status" role="alert">
          <div className="public-shelter__status-sticker" aria-hidden>
            <PawPrint size={48} weight="duotone" />
          </div>
          <h1 className="public-shelter__status-title">Slow down a moment</h1>
          <p className="public-shelter__status-body">
            Too many requests. Try again in a moment.
          </p>
          <a className="public-shelter__status-link" href="/">
            <House size={18} weight="bold" aria-hidden />
            Back to Sanctuary
          </a>
        </div>
      </div>
    )
  }

  if (state.status === 'not-found' || state.status === 'error' || !data) {
    return (
      <div className="public-shelter public-shelter--status">
        <div className="public-shelter__status" role="alert">
          <div className="public-shelter__status-sticker" aria-hidden>
            <PawPrint size={48} weight="duotone" />
          </div>
          <h1 className="public-shelter__status-title">
            This page isn’t available
          </h1>
          <p className="public-shelter__status-body">
            The shelter link may be wrong, or this public page is turned off.
          </p>
          <a className="public-shelter__status-link" href="/">
            <House size={18} weight="bold" aria-hidden />
            Back to Sanctuary
          </a>
        </div>
      </div>
    )
  }

  function openHighlight(items: HighlightItem[], index = 0) {
    if (items.length === 0) return
    setHighlight({ items, index })
  }

  return (
    <div className="public-shelter">
      <header className="public-shelter__masthead">
        <div className="public-shelter__masthead-inner">
          <div className="public-shelter__partner">
            {data.logoUrl ? (
              <img
                className="public-shelter__partner-logo"
                src={data.logoUrl}
                alt=""
                width={48}
                height={48}
              />
            ) : (
              <span className="public-shelter__partner-fallback" aria-hidden>
                {(data.orgName.trim()[0] ?? '?').toUpperCase()}
              </span>
            )}
            <div className="public-shelter__partner-text">
              <h1 className="public-shelter__org-name">{data.orgName}</h1>
              <p className="public-shelter__powered public-shelter__powered--mobile">
                <img src="/favicon.svg" alt="" width={16} height={16} />
                Powered by{' '}
                <a href="/" className="public-shelter__powered-link">
                  Sanctuary
                </a>
              </p>
            </div>
          </div>
          <div className="public-shelter__powered public-shelter__powered--desktop">
            <img src="/favicon.svg" alt="" width={22} height={22} />
            <span>
              Powered by{' '}
              <a href="/" className="public-shelter__powered-link">
                Sanctuary
              </a>
            </span>
          </div>
        </div>
      </header>

      <div className="public-shelter__page">
        <div
          className="public-shelter__sections"
          role="tablist"
          aria-label="Shelter sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'animals'}
            className={
              tab === 'animals'
                ? 'public-shelter__section-tab public-shelter__section-tab--active'
                : 'public-shelter__section-tab'
            }
            onClick={() => setTab('animals')}
          >
            <span className="public-shelter__section-label">Animals</span>
            <span className="public-shelter__section-count">
              {data.animals.length.toLocaleString()}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ledger'}
            className={
              tab === 'ledger'
                ? 'public-shelter__section-tab public-shelter__section-tab--active'
                : 'public-shelter__section-tab'
            }
            onClick={() => setTab('ledger')}
          >
            <span className="public-shelter__section-label">Ledger entries</span>
            <span className="public-shelter__section-count">
              {data.ledger.length.toLocaleString()}
            </span>
          </button>
        </div>

        <div className="public-shelter__page-body">
          <label className="public-shelter__search">
            <MagnifyingGlass size={18} weight="bold" aria-hidden />
            <span className="sr-only">
              Search {tab === 'animals' ? 'animals' : 'ledger'}
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'animals' ? 'Search animals…' : 'Search ledger…'
              }
              autoComplete="off"
            />
          </label>

          <div className="public-shelter__page-content">
            {tab === 'animals' ? (
              <AnimalsPanel
                animals={animals}
                emptyLabel={
                  data.animals.length === 0
                    ? 'No animals to show right now.'
                    : 'No animals match that search.'
                }
              />
            ) : (
              <LedgerPanel
                ledger={ledger}
                totalInCents={totalInCents}
                totalOutCents={totalOutCents}
                emptyLabel={
                  data.ledger.length === 0
                    ? 'No ledger entries to show right now.'
                    : 'No entries match that search.'
                }
                onOpenAttachments={openHighlight}
              />
            )}
          </div>
        </div>
      </div>

      <footer className="public-shelter__footer">
        <a
          className="public-shelter__mohsin"
          href="https://themohsinproject.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Nonprofit software by The Mohsin Project</span>
          <img
            src="/mohsin-project-logo.svg"
            alt=""
            width={48}
            height={27}
          />
        </a>
      </footer>

      {highlight ? (
        <MediaHighlight
          items={highlight.items}
          index={highlight.index}
          onClose={() => setHighlight(null)}
          onIndexChange={(index) =>
            setHighlight((prev) => (prev ? { ...prev, index } : prev))
          }
        />
      ) : null}
    </div>
  )
}

function AnimalsPanel({
  animals,
  emptyLabel,
}: {
  animals: PublicAnimalDto[]
  emptyLabel: string
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [activeAnimalId, setActiveAnimalId] = useState<string | null>(null)
  const [showVerifiedExplain, setShowVerifiedExplain] = useState(false)
  const virtualizer = useVirtualizer({
    count: animals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 12,
  })

  const activeAnimal =
    animals.find((animal) => animal.id === activeAnimalId) ?? null

  if (animals.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>
  }

  return (
    <section
      className="public-shelter__panel"
      aria-labelledby="animals-heading"
    >
      <h2 id="animals-heading" className="sr-only">
        Animals in our care
      </h2>
      <div ref={parentRef} className="public-shelter__scroll">
        <div
          className="public-shelter__virtual"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const animal = animals[virtualRow.index]!
            const cover = animal.photos[0]
            const displayName = animal.name ?? animal.shelterCode
            const hasVerified = animal.photos.some((p) => p.verified)

            return (
              <article
                key={animal.id}
                className="public-shelter__animal"
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="public-shelter__animal-hit"
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  aria-label={`Open care log for ${displayName}`}
                  onClick={() => setActiveAnimalId(animal.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveAnimalId(animal.id)
                    }
                  }}
                >
                  {cover ? (
                    <div className="public-shelter__animal-cover">
                      <img
                        src={cover.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      {animal.photos.length > 1 ? (
                        <span className="public-shelter__cover-count">
                          {animal.photos.length}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className="public-shelter__animal-cover public-shelter__animal-cover--empty"
                      aria-hidden
                    >
                      <PawPrint size={22} weight="duotone" />
                    </div>
                  )}

                  <div className="public-shelter__animal-body">
                    <div className="public-shelter__animal-title">
                      <span className="public-shelter__animal-name">
                        {displayName}
                      </span>
                      {hasVerified ? (
                        <button
                          type="button"
                          className="public-shelter__verified-tick"
                          aria-label="What verified means"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowVerifiedExplain(true)
                          }}
                        >
                          <SealCheck size={16} weight="fill" aria-hidden />
                        </button>
                      ) : null}
                      <span className="public-shelter__code">
                        {animal.shelterCode}
                      </span>
                    </div>
                    <p className="public-shelter__animal-meta">
                      {[animal.species, animal.sex, animal.statusLabel]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {activeAnimal ? (
        <AnimalHighlight
          animal={activeAnimal}
          onClose={() => setActiveAnimalId(null)}
          onExplainVerified={() => setShowVerifiedExplain(true)}
        />
      ) : null}

      {showVerifiedExplain ? (
        <VerifiedExplainDialog onClose={() => setShowVerifiedExplain(false)} />
      ) : null}
    </section>
  )
}

function LedgerPanel({
  ledger,
  totalInCents,
  totalOutCents,
  emptyLabel,
  onOpenAttachments,
}: {
  ledger: PublicLedgerDto[]
  totalInCents: number
  totalOutCents: number
  emptyLabel: string
  onOpenAttachments: (items: HighlightItem[], index?: number) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: ledger.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 16,
  })

  return (
    <section
      className="public-shelter__panel"
      aria-labelledby="ledger-heading"
    >
      <h2 id="ledger-heading" className="sr-only">
        Money in and out
      </h2>

      <div className="public-shelter__ledger-totals" aria-live="polite">
        <div>
          <span>Money in</span>
          <span className="public-shelter__amount--in">
            {formatPkr(totalInCents)}
          </span>
        </div>
        <div>
          <span>Money out</span>
          <span className="public-shelter__amount--out">
            {formatPkr(totalOutCents)}
          </span>
        </div>
      </div>

      {ledger.length === 0 ? (
        <EmptyState>{emptyLabel}</EmptyState>
      ) : (
        <div ref={parentRef} className="public-shelter__scroll">
          <div
            className="public-shelter__virtual"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = ledger[virtualRow.index]!
              const attachmentItems: HighlightItem[] =
                entry.attachmentUrls.map((url, i) => ({
                  url,
                  alt: `Attachment ${i + 1} for ${entry.categoryLabel}`,
                  caption: `${formatDate(entry.entryDate)} · ${entry.categoryLabel}`,
                }))

              return (
                <div
                  key={entry.id}
                  className="public-shelter__ledger-row"
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="public-shelter__ledger-info">
                    <span className="public-shelter__ledger-primary">
                      {formatDate(entry.entryDate)} · {entry.categoryLabel}
                      {entry.isAnonymous ? ' · Anonymous' : ''}
                    </span>
                    {entry.notes ? (
                      <span className="public-shelter__ledger-notes">
                        {entry.notes}
                      </span>
                    ) : null}
                    {attachmentItems.length > 0 ? (
                      <div className="public-shelter__attachments">
                        {attachmentItems.map((item, index) => (
                          <button
                            key={item.url}
                            type="button"
                            className="public-shelter__attachment"
                            onClick={() =>
                              onOpenAttachments(attachmentItems, index)
                            }
                          >
                            <Paperclip size={14} weight="bold" aria-hidden />
                            Proof {index + 1}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={
                      entry.direction === 'in'
                        ? 'public-shelter__amount--in'
                        : 'public-shelter__amount--out'
                    }
                  >
                    {entry.direction === 'in' ? '+' : '−'}
                    {formatPkr(entry.amountCents)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="public-shelter__empty">{children}</p>
}
