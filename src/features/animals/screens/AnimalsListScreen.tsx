import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '@/shared/hooks/useDb'
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

export function AnimalsListScreen() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [animals, setAnimals] = useState<AnimalWithStatus[]>([])
  const [statuses, setStatuses] = useState<AnimalStatus[]>([])
  const [query, setQuery] = useState('')
  const [statusId, setStatusId] = useState('')
  const [species, setSpecies] = useState('')
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!db || !member) return
    void listStatuses(db, member.orgId).then(setStatuses)
  }, [db, member])

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      const rows = await searchAnimals(db, member.orgId, {
        query,
        statusId: statusId || undefined,
        species: species || undefined,
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
    })()
    return () => {
      cancelled = true
    }
  }, [db, member, query, statusId, species])

  return (
    <section className="screen">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Animals</h1>
        <Link className="primary" to="/animals/new" style={{ textDecoration: 'none' }}>
          Intake
        </Link>
      </div>
      <div className="stack">
        <input
          placeholder="Search by ID or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="row">
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Species filter"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          />
        </div>
      </div>
      <div className="animal-grid" style={{ marginTop: '1rem' }}>
        {animals.map((animal) => (
          <AnimalCard
            key={animal.id}
            animal={animal}
            photoUrl={photoUrls[animal.id]}
          />
        ))}
      </div>
      {animals.length === 0 ? (
        <p className="muted">No animals yet. Start with intake.</p>
      ) : null}
    </section>
  )
}
