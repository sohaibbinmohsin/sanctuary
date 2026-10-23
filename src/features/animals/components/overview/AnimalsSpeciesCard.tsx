import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  countAnimalsBySpecies,
  type AnimalSpeciesCount,
} from '@/features/animals/domain/animals'
import { toSentenceCase } from '@/shared/lib/text'

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

      <div className="overview-card">
        {loading && speciesList.length === 0 ? (
          <p className="muted">Loading species…</p>
        ) : speciesList.length === 0 ? (
          <p className="muted">No animal records logged yet.</p>
        ) : (
          <ul className="status-bars">
            {speciesList.map((item) => (
              <li key={item.species} className="status-bars__row">
                <div className="status-bars__meta">
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                    <span>{toSentenceCase(item.species)}</span>
                    {item.childCount > 0 ? (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-muted)', fontWeight: 400 }}>
                        ({item.childCount} {item.childCount === 1 ? 'child' : 'children'})
                      </span>
                    ) : null}
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
