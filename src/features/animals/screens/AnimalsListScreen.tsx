import { useEffect, useState, useDeferredValue } from 'react'
import { MagnifyingGlass, PawPrint } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import { AnimalCard } from '@/features/animals/components/AnimalCard'
import {
  searchAnimals,
  type AnimalWithStatus,
} from '@/features/animals/domain/animals'
import { listStatuses, type AnimalStatus } from '@/features/statuses/domain/statuses'
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
import { FilterMenu } from '@/shared/ui/FilterMenu'

const SPECIES_OPTIONS = [
  { value: 'Dog', label: 'Dog' },
  { value: 'Cat', label: 'Cat' },
  { value: 'Horse', label: 'Horse' },
  { value: 'Donkey', label: 'Donkey' },
  { value: 'Bird', label: 'Bird' },
  { value: 'Other', label: 'Other' },
]

const SEX_OPTIONS = [
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: '__unknown__', label: 'Unknown' },
]

export function AnimalsListScreen() {
  const db = useDb()
  const { member, loading: memberLoading } = useCurrentMember()
  const sync = useSyncStatus()
  const [animals, setAnimals] = useState<AnimalWithStatus[]>([])
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [statusId, setStatusId] = useState('')
  const [species, setSpecies] = useState('')
  const [sex, setSex] = useState('')
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    void listStatuses(db, member.orgId).then(setStatuses)
  }, [db, member])

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rows = await searchAnimals(db, member.orgId, {
          query: deferredQuery,
          statusId: statusId || undefined,
          species: species || undefined,
          sex: sex || undefined,
        })
        if (cancelled) return
        setAnimals(rows)

        const urls: Record<string, string> = {}
        for (const animal of rows.slice(0, 60)) {
          const photos = await listPhotosForAnimal(db, animal.id)
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
        if (!cancelled) setPhotoUrls(urls)
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
  }, [db, member, deferredQuery, statusId, species, sex, sync.hasSynced])

  const hasFilters = Boolean(query || statusId || species || sex)
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

  const statusOptions = statuses.map((s) => ({
    value: s.id,
    label: s.label,
  }))

  return (
    <section className="screen">
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

      <div className="filter-bar">
        <div className="filter-bar__search">
          <MagnifyingGlass size={18} weight="bold" aria-hidden />
          <input
            type="search"
            placeholder="Search by ID or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search animals"
          />
        </div>
        <div className="filter-menus" role="group" aria-label="List filters">
          <FilterMenu
            label="Status"
            value={statusId}
            options={statusOptions}
            onChange={setStatusId}
          />
          <FilterMenu
            label="Type"
            value={species}
            options={SPECIES_OPTIONS}
            onChange={setSpecies}
          />
          <FilterMenu
            label="Gender"
            value={sex}
            options={SEX_OPTIONS}
            onChange={setSex}
          />
        </div>
      </div>

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
          {animals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              photoUrl={photoUrls[animal.id]}
            />
          ))}
        </div>
      )}
    </section>
  )
}
