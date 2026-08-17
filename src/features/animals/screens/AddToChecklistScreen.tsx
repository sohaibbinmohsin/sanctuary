import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Check,
  CloudSlash,
  Funnel,
  List,
  MagnifyingGlass,
  PawPrint,
  SquaresFour,
  WifiSlash,
  X,
} from '@phosphor-icons/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@powersync/react'
import { useDb } from '@/shared/hooks/useDb'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import { emptyAnimalListState } from '@/shared/lib/animals/emptyAnimalListState'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import {
  searchAnimals,
  type AnimalWithStatus,
} from '@/features/animals/domain/animals'
import { addAnimalsToChecklist } from '@/features/checklist/domain/checklist'
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
import { MoraleToast } from '@/shared/ui/MoraleToast'
import {
  parseAnimalFilterParams,
  serializeAnimalFilterParams,
} from '@/shared/lib/animals/filterParams'

type AnimalsView = 'grid' | 'list'

const VIEW_STORAGE_KEY = 'sanctuary.animals.view'
const FILTERS_RETURN = 'add-to-checklist'

function readStoredView(): AnimalsView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    return raw === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function filtersHref(filters: ReturnType<typeof parseAnimalFilterParams>): string {
  const search = serializeAnimalFilterParams(filters)
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  params.set('return', FILTERS_RETURN)
  return `?${params.toString()}`
}

export function AddToChecklistScreen() {
  const db = useDb()
  const navigate = useNavigate()
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
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
  }, [
    db,
    member,
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
  const allVisibleSelected =
    animals.length > 0 && animals.every((animal) => selectedIds.has(animal.id))
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

  function toggleAnimal(animalId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(animalId)) next.delete(animalId)
      else next.add(animalId)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        for (const animal of animals) next.delete(animal.id)
      } else {
        for (const animal of animals) next.add(animal.id)
      }
      return next
    })
  }

  async function confirmAddToChecklist() {
    if (!db || !member || selectedIds.size === 0 || confirming) return
    setConfirming(true)
    try {
      const { added, skipped } = await addAnimalsToChecklist(db, {
        orgId: member.orgId,
        animalIds: [...selectedIds],
        addedBy: member.userId,
      })
      const message =
        skipped > 0
          ? `Added ${added}, skipped ${skipped} already on checklist`
          : `Added ${added}`
      navigate('/checklist', { state: { toast: message } })
    } catch (err) {
      console.warn('Add to checklist failed', err)
      setToast('Could not add to checklist. Try again.')
    } finally {
      setConfirming(false)
    }
  }

  const selectionActions = (
    <>
      <Button
        variant="secondary"
        onClick={() => navigate('/checklist')}
        disabled={confirming}
      >
        Cancel
      </Button>
      <Button
        variant="accent"
        disabled={selectedIds.size === 0 || confirming}
        onClick={() => void confirmAddToChecklist()}
      >
        {confirming ? 'Adding…' : 'Confirm'}
      </Button>
    </>
  )

  return (
    <section className="screen screen--selection">
      <PageHeader
        title="Add to checklist"
        subtitle={
          selectedIds.size > 0
            ? `${selectedIds.size} selected`
            : 'Tap animals to select them'
        }
        backTo="/checklist"
        backLabel="Checklist"
        actions={
          <div className="animal-selection-header-actions">
            <Button
              variant="secondary"
              onClick={toggleAllVisible}
              disabled={animals.length === 0}
            >
              {allVisibleSelected ? 'Deselect all' : 'Select all'}
            </Button>
            <div className="animal-selection-actions animal-selection-actions--top">
              {selectionActions}
            </div>
          </div>
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
        </div>
        <div className="filter-button-wrap">
          <Button
            to={`/animals/filters${filtersHref(filters)}`}
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
      ) : emptyState === 'offline' ? (
        <EmptyState
          icon={<WifiSlash size={28} weight="duotone" />}
          title="No internet"
          body="Can't load animals right now. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => window.location.reload()}
        />
      ) : emptyState === 'failed' ? (
        <EmptyState
          icon={<CloudSlash size={28} weight="duotone" />}
          title="Can't reach Sanctuary"
          body="Your records are safe. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => window.location.reload()}
        />
      ) : animals.length === 0 ? (
        <EmptyState
          icon={<PawPrint size={28} weight="duotone" />}
          title={hasFilters ? 'No matches' : 'No animals yet'}
          body={
            hasFilters
              ? 'Try a different search or clear your filters.'
              : 'Add animals before building a checklist.'
          }
        />
      ) : (
        <div className={listClassName}>
          {animals.map((animal) => {
            const selected = selectedIds.has(animal.id)
            return (
              <div
                key={animal.id}
                className={`animal-card-selectable animal-card-selectable--enabled${isListView ? ' animal-card-selectable--list' : ''}${selected ? ' animal-card-selectable--selected' : ''}`}
                aria-selected={selected}
                onClickCapture={(event) => {
                  event.preventDefault()
                  toggleAnimal(animal.id)
                }}
              >
                <AnimalCard
                  animal={animal}
                  photoUrl={photoUrls[animal.id]}
                  hasVerifiedPhoto={Boolean(verifiedAnimalIds[animal.id])}
                  variant={view}
                />
                <span className="animal-card-selectable__indicator" aria-hidden>
                  {selected ? <Check size={18} weight="bold" /> : null}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="animal-selection-actions animal-selection-actions--bottom">
        {selectionActions}
      </div>

      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
