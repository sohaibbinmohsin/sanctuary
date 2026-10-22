import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  getRescueSpeciesBreakdown,
  type RescueSpeciesCount,
} from '@/features/reports/domain/rescueReports'
import { toSentenceCase } from '@/shared/lib/text'

export function RescueSpeciesCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [speciesList, setSpeciesList] = useState<RescueSpeciesCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getRescueSpeciesBreakdown(db, member.orgId)
        if (!cancelled) setSpeciesList(res)
      } catch (err) {
        console.warn('Failed to load rescue species breakdown', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const maxCount = Math.max(...speciesList.map((s) => s.count), 1)

  return (
    <section className="overview-panel" aria-labelledby="overview-rescue-species-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-rescue-species-title">Rescues by species</h2>
          <p className="muted overview-panel__lede">
            Distribution of reported animals in distress.
          </p>
        </div>
      </div>

      {loading && speciesList.length === 0 ? (
        <p className="muted">Loading species…</p>
      ) : speciesList.length === 0 ? (
        <p className="muted">No animal species reported yet.</p>
      ) : (
        <ul className="status-bars">
          {speciesList.map((item) => (
            <li key={item.species} className="status-bars__row">
              <div className="status-bars__meta">
                <span>{toSentenceCase(item.species)}</span>
                <strong>{item.count}</strong>
              </div>
              <div className="status-bars__track" aria-hidden>
                <div
                  className="status-bars__fill"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
