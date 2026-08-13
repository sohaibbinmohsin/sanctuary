import { useEffect, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { useSyncStatus, type SyncStatusKind } from '@/shared/hooks/useSyncStatus'
import { getSupportEmail } from '@/shared/lib/supabase'

const FAILED_COPY =
  "Can't reach Sanctuary right now. Your data is safe on this phone. Please contact support."

export function SyncBanner() {
  const status = useSyncStatus()
  const supportEmail = getSupportEmail()
  const [dismissedKind, setDismissedKind] = useState<SyncStatusKind | null>(
    null,
  )

  useEffect(() => {
    if (status.kind === 'synced') {
      setDismissedKind(null)
    }
  }, [status.kind])

  if (status.kind === 'synced') return null
  if (dismissedKind === status.kind) return null

  const dismissControl = (
    <button
      type="button"
      className="sync-banner__dismiss"
      aria-label="Dismiss"
      onClick={() => setDismissedKind(status.kind)}
    >
      <X size={18} weight="bold" aria-hidden />
    </button>
  )

  if (status.kind === 'pending') {
    return (
      <div className="sync-banner sync-banner--pending" role="status">
        <span className="sync-banner__text">Saving your updates…</span>
        {dismissControl}
      </div>
    )
  }

  if (status.kind === 'offline') {
    return (
      <div className="sync-banner sync-banner--offline" role="status">
        <span className="sync-banner__text">
          No internet right now. Your work is safe on this phone.
        </span>
        {dismissControl}
      </div>
    )
  }

  return (
    <div className="sync-banner sync-banner--failed" role="alert">
      <div className="sync-banner__body">
        <p>
          {FAILED_COPY}{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
      </div>
      {dismissControl}
    </div>
  )
}

export const CLOUD_UNREACHABLE_MESSAGE = FAILED_COPY
