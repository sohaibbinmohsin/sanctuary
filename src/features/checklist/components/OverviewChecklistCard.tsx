import { useEffect, useMemo, useState } from 'react'
import {
  countChecklistOverdue,
  listChecklist,
  setChecklistChecked,
  type ChecklistRow,
} from '@/features/checklist/domain/checklist'
import {
  enableChecklistPush,
  getPushPermissionState,
  type PushPermissionState,
} from '@/features/checklist/domain/pushSubscribe'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { useDb } from '@/shared/hooks/useDb'
import { Button } from '@/shared/ui/Button'
import { StatusBadge } from '@/shared/ui/StatusBadge'

const PREVIEW_LIMIT = 5

function animalLabel(row: ChecklistRow): string {
  return row.name?.trim() || row.shelter_code || 'Animal'
}

function sortChecklistRows(rows: ChecklistRow[]): ChecklistRow[] {
  return [...rows].sort((a, b) => {
    if (a.checkedToday !== b.checkedToday) {
      return a.checkedToday ? 1 : -1
    }
    const aOverdue = a.missedDays >= 1 ? 1 : 0
    const bOverdue = b.missedDays >= 1 ? 1 : 0
    if (aOverdue !== bOverdue) return bOverdue - aOverdue
    return animalLabel(a).localeCompare(animalLabel(b), undefined, {
      sensitivity: 'base',
    })
  })
}

function missedLabel(missedDays: number): string {
  return missedDays === 1 ? '1 day missed' : `${missedDays} days missed`
}

export function OverviewChecklistCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pushState, setPushState] = useState<PushPermissionState>(() =>
    getPushPermissionState(),
  )
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    setPushState(getPushPermissionState())
  }, [])

  async function onEnableReminders() {
    if (pushBusy) return
    setPushBusy(true)
    try {
      const next = await enableChecklistPush()
      setPushState(next)
    } catch (err) {
      console.warn('Enable checklist push failed', err)
      setPushState(getPushPermissionState())
    } finally {
      setPushBusy(false)
    }
  }

  async function reload(opts?: { quiet?: boolean }) {
    if (!db || !member) return
    if (!opts?.quiet) setLoading(true)
    try {
      setRows(await listChecklist(db, member.orgId))
    } catch (err) {
      console.warn('Overview checklist load failed', err)
      setRows([])
    } finally {
      if (!opts?.quiet) setLoading(false)
    }
  }

  useEffect(() => {
    if (!db || !member) return
    void reload()
  }, [db, member])

  const overdueCount = useMemo(() => countChecklistOverdue(rows), [rows])
  const preview = useMemo(
    () => sortChecklistRows(rows).slice(0, PREVIEW_LIMIT),
    [rows],
  )

  async function onToggle(row: ChecklistRow, checked: boolean) {
    if (!db || !member || busyId) return
    setBusyId(row.id)
    try {
      await setChecklistChecked(db, {
        orgId: member.orgId,
        animalId: row.id,
        checked,
        checkedBy: member.userId,
      })
      await reload({ quiet: true })
    } catch (err) {
      console.warn('Overview checklist check failed', err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="overview-panel" aria-labelledby="overview-checklist-title">
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <h2 id="overview-checklist-title" style={{ margin: 0 }}>
          Checklist
        </h2>
        {overdueCount >= 1 ? (
          <StatusBadge
            label={
              overdueCount === 1 ? '1 overdue' : `${overdueCount} overdue`
            }
            tone="amber"
          />
        ) : null}
      </div>
      <p className="muted overview-panel__lede">
        Today’s care list. Overdue animals need a check.
      </p>

      {pushState === 'default' ? (
        <div className="row" style={{ marginBottom: '0.75rem' }}>
          <Button
            type="button"
            variant="secondary"
            disabled={pushBusy}
            onClick={() => void onEnableReminders()}
          >
            Enable reminders
          </Button>
        </div>
      ) : pushState === 'denied' ? (
        <p className="muted" style={{ marginBottom: '0.75rem' }}>
          Notifications blocked in browser settings.
        </p>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No animals on the checklist yet.</p>
      ) : (
        <div className="panel" style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
          {preview.map((row) => {
            const label = animalLabel(row)
            const disabled = busyId === row.id
            return (
              <div className="list-item list-item--row" key={row.id}>
                <label className="check-row" style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="checkbox"
                    checked={row.checkedToday}
                    disabled={disabled}
                    onChange={(event) =>
                      void onToggle(row, event.target.checked)
                    }
                    aria-label={`Mark ${label} checked today`}
                  />
                  <span>
                    <strong>{label}</strong>
                    {row.name?.trim() && row.shelter_code ? (
                      <span className="muted"> · {row.shelter_code}</span>
                    ) : null}
                    {row.missedDays >= 1 ? (
                      <span
                        className="muted"
                        style={{ display: 'block', color: 'var(--color-amber)' }}
                      >
                        {missedLabel(row.missedDays)}
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>
            )
          })}
        </div>
      )}

      <div className="row" style={{ marginTop: '1rem' }}>
        <Button to="/checklist" variant="secondary">
          View all
        </Button>
      </div>
    </section>
  )
}
