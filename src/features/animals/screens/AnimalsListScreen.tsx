import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Check, Funnel, MagnifyingGlass, PawPrint } from '@phosphor-icons/react'
import { useSearchParams } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
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
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
    // Re-run after the first PowerSync download fills an empty local DB
    // (common on a fresh tunnel origin / new browser profile).
  }, [
    db,
    member,
    deferredQuery,
    filters.statusIds,
    filters.statusMode,
    filters.species,
    filters.sex,
    sync.hasSynced,
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
  const awaitingFirstSync =
    !hasFilters && animals.length === 0 && !sync.hasSynced && sync.kind !== 'failed'
  const showLoading = memberLoading || loading || awaitingFirstSync

  const subtitle = !member?.orgName
    ? awaitingFirstSync
      ? 'Loading animals…'
      : 'Everyone currently in your care'
    : hasFilters
      ? `${animals.length} match${animals.length === 1 ? '' : 'es'}`
      : awaitingFirstSync
        ? `Loading animals at ${member.orgName}…`
        : `${animals.length} in care at ${member.orgName}`

  const filterSearch = serializeAnimalFilterParams(filters)
  const allVisibleSelected =
    animals.length > 0 && animals.every((animal) => selectedIds.has(animal.id))

  function updateQuery(query: string) {
    const nextSearch = serializeAnimalFilterParams({ ...filters, query })
    setSearchParams(nextSearch.startsWith('?') ? nextSearch.slice(1) : nextSearch, {
      replace: true,
    })
  }

  function startSelecting() {
    setSelectedIds(new Set())
    setSelectMode(true)
  }

  function finishSelecting() {
    setSelectedIds(new Set())
    setSelectMode(false)
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
      setToast(message)
      finishSelecting()
    } catch (err) {
      console.warn('Add to checklist failed', err)
      setToast('Could not add to checklist. Try again.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <section className="screen">
      <PageHeader
        title={selectMode ? 'Select animals' : 'Animals'}
        subtitle={subtitle}
        actions={
          !selectMode && (animals.length > 0 || hasFilters) ? (
            <Button to="/animals/new" variant="accent">
              Add animal
            </Button>
          ) : undefined
        }
      />

      {selectMode ? (
        <div className="animal-selection-toolbar">
          <span>
            {selectedIds.size} selected
          </span>
          <Button
            variant="secondary"
            onClick={toggleAllVisible}
            disabled={animals.length === 0}
          >
            {allVisibleSelected ? 'Deselect all' : 'Select all'}
          </Button>
        </div>
      ) : (
        <div className="filter-bar filter-bar--chrome">
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
          <Button
            to={`/animals/filters${filterSearch}`}
            variant="secondary"
            className={`btn--icon filter-button${hasAdvancedFilters ? ' filter-button--active' : ''}`}
            aria-label="Filter animals"
            title="Filter animals"
          >
            <Funnel size={20} weight={hasAdvancedFilters ? 'fill' : 'bold'} aria-hidden />
          </Button>
          <Button
            variant="secondary"
            onClick={startSelecting}
            disabled={animals.length === 0}
          >
            Add to checklist
          </Button>
        </div>
      )}

      {showLoading ? (
        <div className="animal-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ aspectRatio: '1', height: 'auto' }}
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
        <div className="animal-grid">
          {animals.map((animal) => {
            const selected = selectedIds.has(animal.id)
            return (
              <div
                key={animal.id}
                className={`animal-card-selectable${selectMode ? ' animal-card-selectable--enabled' : ''}${selected ? ' animal-card-selectable--selected' : ''}`}
                aria-selected={selectMode ? selected : undefined}
                onClickCapture={
                  selectMode
                    ? (event) => {
                        event.preventDefault()
                        toggleAnimal(animal.id)
                      }
                    : undefined
                }
              >
                <AnimalCard
                  animal={animal}
                  photoUrl={photoUrls[animal.id]}
                  hasVerifiedPhoto={Boolean(verifiedAnimalIds[animal.id])}
                />
                {selectMode ? (
                  <span className="animal-card-selectable__indicator" aria-hidden>
                    {selected ? <Check size={18} weight="bold" /> : null}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {selectMode ? (
        <div className="animal-selection-actions">
          <Button variant="secondary" onClick={finishSelecting} disabled={confirming}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={selectedIds.size === 0 || confirming}
            onClick={() => void confirmAddToChecklist()}
          >
            Confirm
          </Button>
        </div>
      ) : null}

      <MoraleToast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
