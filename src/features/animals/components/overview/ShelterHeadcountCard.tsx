import { useEffect, useState } from 'react'
import { Cat, User, Baby } from '@phosphor-icons/react'
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
        <div className="dashboard-card__header dashboard-card__header--brand">
          <h3 className="dashboard-card__title dashboard-card__title--brand" style={{ fontSize: '1rem', margin: 0 }}>
            {member?.orgName ?? 'Sanctuary Sanctuary'}
          </h3>
          <Cat size={24} weight="duotone" color="var(--color-forest)" aria-hidden />
        </div>

        <div className="dashboard-card__hero">
          <p className="dashboard-card__count">{loading ? '…' : headcount}</p>
          <p className="dashboard-card__count-label">animals in care</p>
        </div>

        <div className="checklist-summary" style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', boxShadow: 'none' }}>
          <div className="checklist-summary__metric">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-forest)' }}>
              <User size={16} weight="bold" aria-hidden />
              <p className="checklist-summary__value">{lifeStage.adult}</p>
            </div>
            <p className="checklist-summary__label">adults</p>
          </div>
          <div className="checklist-summary__metric">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-brand)' }}>
              <Baby size={16} weight="bold" aria-hidden />
              <p className="checklist-summary__value">{lifeStage.child}</p>
            </div>
            <p className="checklist-summary__label">babies / children</p>
          </div>
        </div>
      </div>
    </section>
  )
}
