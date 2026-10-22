import { useEffect, useState } from 'react'
import { FirstAid, Scales, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  getRescueCategoryBreakdown,
  type RescueCategoryBreakdown,
} from '@/features/reports/domain/rescueReports'

export function RescueCategoryCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [data, setData] = useState<RescueCategoryBreakdown>({
    emergency: 0,
    cruelty: 0,
    crueltyLegalNotice: 0,
    crueltyDismissed: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getRescueCategoryBreakdown(db, member.orgId)
        if (!cancelled) setData(res)
      } catch (err) {
        console.warn('Failed to load rescue category breakdown', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const total = data.emergency + data.cruelty
  const maxVal = Math.max(data.emergency, data.cruelty, 1)

  return (
    <section className="overview-panel" aria-labelledby="overview-rescue-category-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-rescue-category-title">Reports by category</h2>
          <p className="muted overview-panel__lede">
            Emergency medical dispatch vs animal cruelty investigations.
          </p>
        </div>
      </div>

      <div className="panel panel--soft" style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
        {loading && total === 0 ? (
          <p className="muted">Loading categories…</p>
        ) : total === 0 ? (
          <p className="muted">No reports logged yet.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                    <FirstAid size={16} weight="duotone" color="var(--color-brand)" aria-hidden />
                    Medical Emergency
                  </span>
                  <strong>{data.emergency}</strong>
                </div>
                <div className="status-bars__track" aria-hidden>
                  <div
                    className="status-bars__fill"
                    style={{
                      width: `${(data.emergency / maxVal) * 100}%`,
                      background: 'var(--color-brand)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                    <Scales size={16} weight="duotone" color="var(--color-forest)" aria-hidden />
                    Animal Cruelty
                  </span>
                  <strong>{data.cruelty}</strong>
                </div>
                <div className="status-bars__track" aria-hidden>
                  <div
                    className="status-bars__fill"
                    style={{
                      width: `${(data.cruelty / maxVal) * 100}%`,
                      background: 'var(--color-forest)',
                    }}
                  />
                </div>
              </div>
            </div>

            {data.cruelty > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-4)',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle size={14} weight="bold" color="var(--color-forest)" aria-hidden />
                  <span><strong>{data.crueltyLegalNotice}</strong> legal notices issued</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <WarningCircle size={14} weight="bold" color="var(--color-ink-muted)" aria-hidden />
                  <span><strong>{data.crueltyDismissed}</strong> dismissed</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
