import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Funnel,
  List,
  MagnifyingGlass,
  PawPrint,
  SquaresFour,
  X,
} from '@phosphor-icons/react'
import { useQuery } from '@powersync/react'
import { useSearchParams } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import { emptyAnimalListState } from '@/shared/lib/animals/emptyAnimalListState'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import {
  searchAnimals,
  type AnimalWithStatus,
} from '@/features/animals/domain/animals'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  getLocalPhoto,
  listPhotosForAnimal,
  localPhotoUrl,
} from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  parseAnimalFilterParams,
  serializeAnimalFilterParams,
} from '@/shared/lib/animals/filterParams'

type AnimalsView = 'grid' | 'list'

const VIEW_STORAGE_KEY = 'sanctuary.animals.view'

function readStoredView(): AnimalsView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    return raw === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function AnimalsListScreen() {
  const db = useDb()
  const { member, loading: memberLoading } = useCurrentMember()
  const sync = useSyncStatus()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(
    () => parseAnimalFilterParams(searchParams.toString()),
    [searchParams],
  )
  const [animals, setAnimals] = useState<AnimalWithStatus[]>([])
  const deferredQuery = useDeferredValue(filters.query)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [verifiedAnimalIds, setVerifiedAnimalIds] = useState<
    Record<string, boolean>
  >({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<AnimalsView>(() => readStoredView())
  const { data: animalCountRows } = useQuery<{ n: number }>(
    member?.orgId
      ? `SELECT COUNT(*) as n FROM animals WHERE org_id = ? AND archived = 0`
      : `SELECT COUNT(*) as n FROM animals WHERE 0`,
    member?.orgId ? [member.orgId] : [],
  )
  const localAnimalCount = Number(animalCountRows?.[0]?.n ?? 0)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rows = await searchAnimals(db, member.orgId, {
          query: deferredQuery,
          statusIds: filters.statusIds,
          statusMode: filters.statusMode,
          species: filters.species || undefined,
          sex: filters.sex || undefined,
        })
        if (cancelled) return
        setAnimals(rows)

        const urls: Record<string, string> = {}
        const verified: Record<string, boolean> = {}
        for (const animal of rows.slice(0, 60)) {
          const photos = await listPhotosForAnimal(db, animal.id)
          verified[animal.id] = photos.some((p) => Boolean(p.verified))
          const first = photos[0]
          if (!first) continue
          const remote = publicPhotoUrl(first.r2_key)
          if (remote) {
            urls[animal.id] = remote
            continue
          }
          const local = await getLocalPhoto(first.id)
          if (local) {
            urls[animal.id] = URL.createObjectURL(local)
          } else {
            urls[animal.id] = localPhotoUrl(first.id)
          }
        }
        if (!cancelled) {
          setPhotoUrls(urls)
          setVerifiedAnimalIds(verified)
        }
      } catch (err) {
        console.warn('Animal search failed', err)
        if (!cancelled) setAnimals([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // Re-run when PowerSync inserts rows (hasSynced can already be true).
  }, [
    db,
    member?.orgId,
    deferredQuery,
    filters.statusIds,
    filters.statusMode,
    filters.species,
    filters.sex,
    sync.hasSynced,
    sync.kind,
    localAnimalCount,
  ])

  const hasFilters = Boolean(
    filters.query ||
      filters.statusIds.length ||
      filters.species ||
      filters.sex,
  )
  const hasAdvancedFilters = Boolean(
    filters.statusIds.length || filters.species || filters.sex,
  )
  const emptyState =
    animals.length === 0 ? emptyAnimalListState(sync) : 'ready'
  const showLoading = memberLoading || loading || emptyState === 'loading'
  const isListView = view === 'list'

  const subtitle = !member?.orgName
    ? emptyState === 'loading'
      ? 'Loading animals…'
      : 'Everyone currently in your care'
    : hasFilters
      ? `${animals.length} match${animals.length === 1 ? '' : 'es'}`
      : emptyState === 'loading'
        ? `Loading animals at ${member.orgName}…`
        : `${animals.length} in care at ${member.orgName}`

  const filterSearch = serializeAnimalFilterParams(filters)
  const listClassName = isListView ? 'animal-list' : 'animal-grid'

  function updateQuery(query: string) {
    const nextSearch = serializeAnimalFilterParams({ ...filters, query })
    setSearchParams(nextSearch.startsWith('?') ? nextSearch.slice(1) : nextSearch, {
      replace: true,
    })
  }

  function clearAdvancedFilters() {
    const nextSearch = serializeAnimalFilterParams({
      ...filters,
      statusIds: [],
      statusMode: 'any',
      species: '',
      sex: '',
    })
    setSearchParams(nextSearch.startsWith('?') ? nextSearch.slice(1) : nextSearch, {
      replace: true,
    })
  }

  function toggleView() {
    setView((current) => {
      const next: AnimalsView = current === 'grid' ? 'list' : 'grid'
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, next)
      } catch {
        /* ignore quota / private mode */
      }
      return next
    })
  }

  return (
    <section className={showLoading || animals.length > 0 ? 'screen' : 'screen screen--empty'}>
      <PageHeader
        title="Animals"
        subtitle={subtitle}
        actions={
          animals.length > 0 || hasFilters ? (
            <Button to="/animals/new" variant="accent">
              Add animal
            </Button>
          ) : undefined
        }
      />

      <div className="filter-bar filter-bar--chrome filter-bar--chrome-3">
        <div className="filter-bar__search">
          <MagnifyingGlass size={18} weight="bold" aria-hidden />
          <input
            type="search"
            placeholder="Search by ID or name"
            value={filters.query}
            onChange={(event) => updateQuery(event.target.value)}
            aria-label="Search animals"
          />
          {filters.query ? (
            <button
              type="button"
              className="filter-bar__clear"
              onClick={() => updateQuery('')}
              aria-label="Clear search"
            >
              <X size={14} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="filter-button-wrap">
          <Button
            to={`/animals/filters${filterSearch}`}
            variant="secondary"
            className={`btn--icon filter-button${hasAdvancedFilters ? ' filter-button--active' : ''}`}
            aria-label="Filter animals"
            title="Filter animals"
          >
            <Funnel size={20} weight={hasAdvancedFilters ? 'fill' : 'bold'} aria-hidden />
          </Button>
          {hasAdvancedFilters ? (
            <button
              type="button"
              className="filter-button__clear"
              aria-label="Clear filters"
              title="Clear filters"
              onClick={clearAdvancedFilters}
            >
              <X size={12} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="btn--icon"
          onClick={toggleView}
          aria-label={isListView ? 'Switch to grid view' : 'Switch to list view'}
          title={isListView ? 'Grid view' : 'List view'}
        >
          {isListView ? (
            <SquaresFour size={20} weight="bold" aria-hidden />
          ) : (
            <List size={20} weight="bold" aria-hidden />
          )}
        </Button>
      </div>

      {showLoading ? (
        <div className={listClassName}>
          {Array.from({ length: isListView ? 8 : 6 }).map((_, i) => (
            <div
              key={i}
              className={
                isListView ? 'skeleton animal-list__skeleton' : 'skeleton'
              }
              style={
                isListView ? undefined : { aspectRatio: '1', height: 'auto' }
              }
            />
          ))}
        </div>
      ) : animals.length === 0 ? (
        <EmptyState
          icon={<PawPrint size={28} weight="duotone" />}
          title={hasFilters ? 'No matches' : 'No animals yet'}
          body={
            hasFilters
              ? 'Try a different search or clear your filters.'
              : 'Start by adding the first animal in your care.'
          }
          actionLabel={hasFilters ? undefined : 'Add animal'}
          actionTo={hasFilters ? undefined : '/animals/new'}
        />
      ) : (
        <div className={listClassName}>
          {animals.map((animal) => (
            <div key={animal.id} className="animal-card-selectable">
              <AnimalCard
                animal={animal}
                photoUrl={photoUrls[animal.id]}
                hasVerifiedPhoto={Boolean(verifiedAnimalIds[animal.id])}
                variant={view}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
