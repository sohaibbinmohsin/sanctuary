import { useEffect, useMemo, useState, useCallback } from 'react'
import { CheckSquare, Eye, Trash } from '@phosphor-icons/react'
import { useLocation } from 'react-router-dom'
import {
  listChecklist,
  removeFromChecklist,
  setChecklistChecked,
  type ChecklistRow,
} from '@/features/checklist/domain/checklist'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { useDb } from '@/shared/hooks/useDb'
import { Button } from '@/shared/ui/Button'
import { CheckMark } from '@/shared/ui/CheckMark'
import { EmptyState } from '@/shared/ui/EmptyState'
import { MoraleToast } from '@/shared/ui/MoraleToast'
import { PageHeader } from '@/shared/ui/PageHeader'
import {
  checklistTickMessage,
  willCompleteChecklist,
} from '@/shared/lib/morale/messages'
import { ChecklistCompleteCelebration } from '@/features/checklist/components/ChecklistCompleteCelebration'
import { ChecklistRemindersControl } from '@/features/checklist/components/ChecklistRemindersControl'
import type { ChecklistPushStatus } from '@/features/checklist/domain/pushSubscribe'

const REMINDERS_DOCK_DISMISS_KEY = 'sanctuary.checklist.remindersDockDismissed'

function remindersDockWasDismissed(): boolean {
  try {
    return localStorage.getItem(REMINDERS_DOCK_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

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
  const location = useLocation()
  const { member, loading: memberLoading } = useCurrentMember()
  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [remindersDock, setRemindersDock] = useState<'loading' | 'show' | 'hide'>(
    () => (remindersDockWasDismissed() ? 'hide' : 'loading'),
  )

  const onRemindersStatus = useCallback((status: ChecklistPushStatus) => {
    if (remindersDockWasDismissed()) {
      setRemindersDock('hide')
      return
    }
    setRemindersDock(status === 'on' ? 'hide' : 'show')
  }, [])

  const onDismissRemindersDock = useCallback(() => {
    try {
      localStorage.setItem(REMINDERS_DOCK_DISMISS_KEY, '1')
    } catch {
      // Private mode / quota — still hide for this visit.
    }
    setRemindersDock('hide')
  }, [])

  useEffect(() => {
    const message = (location.state as { toast?: string } | null)?.toast
    if (message) setToast(message)
  }, [location.state])

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
    const completing = willCompleteChecklist(rows, row, checked)
    setBusyId(row.id)
    try {
      await setChecklistChecked(db, {
        orgId: member.orgId,
        animalId: row.id,
        checked,
        checkedBy: member.userId,
      })
      await reload({ quiet: true })
      if (completing) {
        setCelebrate(true)
      } else if (checked) {
        setToast(checklistTickMessage(animalLabel(row)))
      }
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
    <section
      className={`screen${remindersDock === 'show' ? ' screen--sticky-footer' : ''}${
        !showLoading && rows.length === 0 ? ' screen--empty screen--checklist-empty' : ''
      }`}
    >
      <PageHeader
        title="Checklist"
        subtitle={subtitle}
        actions={
          rows.length > 0 ? (
            <Button to="/animals/add-to-checklist" variant="accent">
              Add to checklist
            </Button>
          ) : undefined
        }
      />

      {showLoading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} weight="duotone" />}
          title="Checklist is empty"
          body="Choose animals to add to today’s checklist."
          actionLabel="Add to checklist"
          actionTo="/animals/add-to-checklist"
        />
      ) : (
        <div className="panel" style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
          {sorted.map((row) => {
            const label = animalLabel(row)
            const disabled = busyId === row.id
            return (
              <div className="list-item list-item--row" key={row.id}>
                <label className="check-row" style={{ flex: 1, minWidth: 0 }}>
                  <CheckMark
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
                    to={`/animals/${row.id}`}
                    state={{ backTo: '/checklist', backLabel: 'Checklist' }}
                    variant="ghost"
                    className="btn--icon"
                    aria-label={`View ${label}`}
                    title="View animal"
                  >
                    <Eye size={18} weight="bold" aria-hidden />
                  </Button>
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

      {remindersDock !== 'hide' ? (
        <div
          className="sticky-actions sticky-actions--reminders"
          hidden={remindersDock !== 'show'}
          aria-hidden={remindersDock !== 'show'}
        >
          <ChecklistRemindersControl
            layout="dock"
            onStatusChange={onRemindersStatus}
            onDismiss={onDismissRemindersDock}
          />
        </div>
      ) : null}

      <MoraleToast message={toast} onDone={() => setToast(null)} />
      <ChecklistCompleteCelebration
        active={celebrate}
        onDone={() => setCelebrate(false)}
      />
    </section>
  )
}
