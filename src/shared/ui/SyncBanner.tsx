import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import { getSupportEmail } from '@/shared/lib/supabase'

const FAILED_COPY =
  "Can't reach Sanctuary cloud right now. Your data is safe on this phone. Please contact support."

export function SyncBanner() {
  const status = useSyncStatus()
  const supportEmail = getSupportEmail()

  if (status === 'synced') return null

  if (status === 'pending') {
    return (
      <div className="sync-banner sync-banner--pending" role="status">
        Syncing changes…
      </div>
    )
  }

  if (status === 'offline') {
    return (
      <div className="sync-banner sync-banner--offline" role="status">
        You&apos;re offline. Changes stay on this phone until you reconnect.
      </div>
    )
  }

  return (
    <div className="sync-banner sync-banner--failed" role="alert">
      <p>{FAILED_COPY}</p>
      <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
    </div>
  )
}

export const CLOUD_UNREACHABLE_MESSAGE = FAILED_COPY
