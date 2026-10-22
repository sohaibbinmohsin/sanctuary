import { useEffect, useState } from 'react'
import { PawPrint } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  countAnimalsBySpecies,
  type AnimalSpeciesCount,
} from '@/features/animals/domain/animals'

export function AnimalsSpeciesCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [speciesList, setSpeciesList] = useState<AnimalSpeciesCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const counts = await countAnimalsBySpecies(db, member.orgId)
        if (!cancelled) setSpeciesList(counts)
      } catch (err) {
        console.warn('Failed to load animal species', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const maxVal = Math.max(...speciesList.map((s) => s.count), 1)

  return (
    <section className="overview-panel" aria-labelledby="overview-shelter-species-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-shelter-species-title">Shelter species</h2>
          <p className="muted overview-panel__lede">
            Breakdown of resident animals in sanctuary care.
          </p>
        </div>
      </div>

      <div className="panel panel--soft" style={{ padding: 'var(--space-4)' }}>
        {loading && speciesList.length === 0 ? (
          <p className="muted">Loading species…</p>
        ) : speciesList.length === 0 ? (
          <p className="muted">No animal records logged yet.</p>
        ) : (
          <ul className="status-bars">
            {speciesList.map((item) => (
              <li key={item.species} className="status-bars__row">
                <div className="status-bars__meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <PawPrint size={14} weight="duotone" color="var(--color-forest)" aria-hidden />
                    {item.species}
                  </span>
                  <strong>{item.count}</strong>
                </div>
                <div className="status-bars__track" aria-hidden>
                  <div
                    className="status-bars__fill"
                    style={{ width: `${(item.count / maxVal) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
