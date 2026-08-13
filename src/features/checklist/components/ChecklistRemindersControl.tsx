import { useEffect, useState, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import {
  disableChecklistPush,
  enableChecklistPush,
  getChecklistPushStatus,
  type ChecklistPushStatus,
} from '@/features/checklist/domain/pushSubscribe'
import { Button } from '@/shared/ui/Button'

type ChecklistRemindersControlProps = {
  className?: string
  /** `dock` = full-width control for a fixed bottom card on Checklist. */
  layout?: 'inline' | 'dock'
  /** Fired after status resolves / changes (dock uses this to hide when on). */
  onStatusChange?: (status: ChecklistPushStatus) => void
  /** Dock only: hide the card (reminders stay available in Settings). */
  onDismiss?: () => void
}

function RemindersExplainer() {
  return (
    <div className="checklist-reminders-explainer">
      <p className="checklist-reminders-explainer__lead">
        We’ll nudge this device when checklist animals still need a check.
      </p>
      <ul className="checklist-reminders-explainer__list">
        <li>Around 6:00 in the evening if today’s list isn’t finished</li>
        <li>Around 8:00 in the morning if any checks were missed</li>
      </ul>
    </div>
  )
}

/** Shows checklist push reminder status / enable control for this device. */
export function ChecklistRemindersControl({
  className,
  layout = 'inline',
  onStatusChange,
  onDismiss,
}: ChecklistRemindersControlProps) {
  const [status, setStatus] = useState<ChecklistPushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await getChecklistPushStatus()
      if (cancelled) return
      setStatus(next)
      onStatusChange?.(next)
    })()
    return () => {
      cancelled = true
    }
  }, [onStatusChange])

  async function applyStatus(next: ChecklistPushStatus) {
    setStatus(next)
    onStatusChange?.(next)
  }

  async function onEnable() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await applyStatus(await enableChecklistPush())
    } catch (err) {
      console.warn('Enable checklist push failed', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not enable reminders. Try again.',
      )
      await applyStatus(await getChecklistPushStatus())
    } finally {
      setBusy(false)
    }
  }

  async function onDisable() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await applyStatus(await disableChecklistPush())
    } catch (err) {
      console.warn('Disable checklist push failed', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not turn off reminders. Try again.',
      )
      await applyStatus(await getChecklistPushStatus())
    } finally {
      setBusy(false)
    }
  }

  // Dock only prompts to enable; once on, Checklist hides the card entirely.
  if (layout === 'dock' && (status === null || status === 'on')) {
    return null
  }

  const rootClass = [
    'checklist-reminders-control',
    'stack',
    layout === 'dock' ? 'checklist-reminders-dock' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  let action: ReactNode = null

  if (status === null) {
    action = <p className="muted" style={{ margin: 0 }}>Checking reminders…</p>
  } else if (status === 'on') {
    action = (
      <Button
        type="button"
        variant="danger-outline"
        block={layout === 'dock'}
        disabled={busy}
        onClick={() => void onDisable()}
      >
        {busy ? 'Turning off…' : 'Turn off reminders'}
      </Button>
    )
  } else if (status === 'denied') {
    action = (
      <p className="muted" style={{ margin: 0 }}>
        Notifications are blocked in browser settings. Allow them for this site,
        then return here to enable reminders.
      </p>
    )
  } else if (status === 'unsupported') {
    action = (
      <p className="muted" style={{ margin: 0 }}>
        Reminders aren’t available in this browser. Try Chrome or Edge on HTTPS
        (or localhost).
      </p>
    )
  } else if (status === 'no-vapid') {
    action = (
      <p className="muted" style={{ margin: 0 }}>
        Reminders aren’t set up yet for this install (missing push keys).
      </p>
    )
  } else {
    action = (
      <Button
        type="button"
        variant={layout === 'dock' ? 'accent' : 'secondary'}
        block={layout === 'dock'}
        disabled={busy}
        onClick={() => void onEnable()}
      >
        {busy ? 'Enabling…' : 'Enable reminders'}
      </Button>
    )
  }

  return (
    <div className={rootClass}>
      {layout === 'dock' ? (
        <div className="checklist-reminders-dock__head">
          <p className="checklist-reminders-dock__title">Checklist reminders</p>
          {onDismiss ? (
            <button
              type="button"
              className="checklist-reminders-dock__close"
              aria-label="Hide reminders. You can enable them later in Settings."
              onClick={onDismiss}
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <RemindersExplainer />
      {action}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}
