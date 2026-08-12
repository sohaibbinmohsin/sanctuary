import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Trash } from '@phosphor-icons/react'
import {
  listChecklist,
  removeFromChecklist,
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
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'

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

export function ChecklistScreen() {
  const db = useDb()
  const { member, loading: memberLoading } = useCurrentMember()
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
      console.warn('Checklist load failed', err)
      setRows([])
    } finally {
      if (!opts?.quiet) setLoading(false)
    }
  }

  useEffect(() => {
    if (!db || !member) return
    void reload()
  }, [db, member])

  const sorted = useMemo(() => sortChecklistRows(rows), [rows])

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
      console.warn('Checklist check failed', err)
    } finally {
      setBusyId(null)
    }
  }

  async function onRemove(row: ChecklistRow) {
    if (!db || !member || busyId) return
    setBusyId(row.id)
    try {
      await removeFromChecklist(db, {
        orgId: member.orgId,
        animalId: row.id,
      })
      await reload({ quiet: true })
    } catch (err) {
      console.warn('Checklist remove failed', err)
    } finally {
      setBusyId(null)
    }
  }

  const showLoading = memberLoading || (loading && rows.length === 0)
  const subtitle =
    showLoading
      ? 'Loading checklist…'
      : rows.length === 0
        ? 'Daily care checklist for your shelter'
        : `${rows.length} on today’s checklist`

  return (
    <section className="screen">
      <PageHeader
        title="Checklist"
        subtitle={subtitle}
        backTo="/dashboard"
        backLabel="Overview"
      />

      {pushState === 'default' ? (
        <div className="row" style={{ marginBottom: '1rem' }}>
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
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Notifications blocked in browser settings.
        </p>
      ) : null}

      {showLoading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} weight="duotone" />}
          title="Checklist is empty"
          body="Select animals on the Animals page and add them to the checklist."
          actionLabel="Go to Animals"
          actionTo="/animals"
        />
      ) : (
        <div className="panel" style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
          {sorted.map((row) => {
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
                <div className="list-item__actions">
                  <Button
                    type="button"
                    variant="danger-ghost"
                    disabled={disabled}
                    onClick={() => void onRemove(row)}
                    aria-label={`Remove ${label} from checklist`}
                    title="Remove from checklist"
                  >
                    <Trash size={18} weight="bold" aria-hidden />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
