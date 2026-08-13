import { useEffect, useMemo, useState } from 'react'
import {
  countChecklistOverdue,
  listChecklist,
  type ChecklistRow,
} from '@/features/checklist/domain/checklist'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { useDb } from '@/shared/hooks/useDb'

export function OverviewChecklistCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const next = await listChecklist(db, member.orgId)
        if (!cancelled) setRows(next)
      } catch (err) {
        console.warn('Overview checklist load failed', err)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const overdueCount = useMemo(() => countChecklistOverdue(rows), [rows])
  const checkedCount = useMemo(
    () => rows.filter((row) => row.checkedToday).length,
    [rows],
  )

  return (
    <section className="overview-panel" aria-labelledby="overview-checklist-title">
      <h2 id="overview-checklist-title">Checklist</h2>
      <p className="muted overview-panel__lede">
        Today’s care list. Overdue animals need a check.
      </p>

      {loading && rows.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="panel panel--soft checklist-summary">
          <p className="checklist-summary__empty">
            No animals on the checklist yet. Open Checklist to add animals.
          </p>
        </div>
      ) : (
        <div className="checklist-summary" aria-label="Checklist summary">
          <div className="checklist-summary__metric">
            <p className="checklist-summary__value">{rows.length}</p>
            <p className="checklist-summary__label">on list</p>
          </div>
          <div className="checklist-summary__metric">
            <p className="checklist-summary__value">
              {checkedCount}
              <span className="checklist-summary__of">/{rows.length}</span>
            </p>
            <p className="checklist-summary__label">checked today</p>
          </div>
          <div className="checklist-summary__metric">
            <p
              className={
                overdueCount >= 1
                  ? 'checklist-summary__value checklist-summary__value--amber'
                  : 'checklist-summary__value'
              }
            >
              {overdueCount}
            </p>
            <p className="checklist-summary__label">overdue</p>
          </div>
        </div>
      )}
    </section>
  )
}
