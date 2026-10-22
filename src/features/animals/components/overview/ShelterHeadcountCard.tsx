import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  countInCare,
  countAnimalsByLifeStage,
  type AnimalLifeStageCount,
} from '@/features/animals/domain/animals'

export function ShelterHeadcountCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [headcount, setHeadcount] = useState(0)
  const [lifeStage, setLifeStage] = useState<AnimalLifeStageCount>({ adult: 0, child: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const [count, stages] = await Promise.all([
          countInCare(db, member.orgId),
          countAnimalsByLifeStage(db, member.orgId),
        ])
        if (!cancelled) {
          setHeadcount(count)
          setLifeStage(stages)
        }
      } catch (err) {
        console.warn('Failed to load shelter headcount', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  return (
    <section className="overview-panel" aria-labelledby="overview-shelter-headcount-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-shelter-headcount-title">Shelter animals</h2>
          <p className="muted overview-panel__lede">
            Resident animals currently under care in the sanctuary.
          </p>
        </div>
      </div>

      <div className="dashboard-card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 'var(--space-2)',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'center' }}>
            <p className="dashboard-card__count" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.25rem)' }}>
              {loading ? '…' : headcount}
            </p>
            <p className="dashboard-card__count-label">Animals in care</p>
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'center' }}>
            <p className="dashboard-card__count" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', color: 'var(--color-ink)' }}>
              {loading ? '…' : lifeStage.adult}
            </p>
            <p className="dashboard-card__count-label">Adults</p>
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'center' }}>
            <p className="dashboard-card__count" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', color: 'var(--color-ink)' }}>
              {loading ? '…' : lifeStage.child}
            </p>
            <p className="dashboard-card__count-label">Children</p>
          </div>
        </div>
      </div>
    </section>
  )
}
