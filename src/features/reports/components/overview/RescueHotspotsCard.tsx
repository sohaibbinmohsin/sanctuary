import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  getRescueHotspots,
  type RescueHotspot,
} from '@/features/reports/domain/rescueReports'
import { toSentenceCase } from '@/shared/lib/text'

export function RescueHotspotsCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [hotspots, setHotspots] = useState<RescueHotspot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getRescueHotspots(db, member.orgId, 5)
        if (!cancelled) setHotspots(res)
      } catch (err) {
        console.warn('Failed to load rescue hotspots', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  return (
    <section className="overview-panel" aria-labelledby="overview-rescue-hotspots-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-rescue-hotspots-title">Rescue hotspots</h2>
          <p className="muted overview-panel__lede">
            Most frequently reported neighborhoods and locations.
          </p>
        </div>
      </div>

      <div className="overview-card">
        {loading && hotspots.length === 0 ? (
          <p className="muted">Loading hotspots…</p>
        ) : hotspots.length === 0 ? (
          <p className="muted">No location data recorded yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }}>
            {hotspots.map((spot, index) => (
              <li
                key={`${spot.area}-${spot.city}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                    {toSentenceCase(spot.area)}
                  </div>
                  {spot.city && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-muted)' }}>
                      {toSentenceCase(spot.city)}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-forest)',
                    background: 'var(--color-forest-soft)',
                  }}
                >
                  {spot.count} {spot.count === 1 ? 'case' : 'cases'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
