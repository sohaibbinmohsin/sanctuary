import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import { getSupportEmail } from '@/shared/lib/supabase'

const FAILED_COPY =
  "Can't reach Sanctuary right now. Your data is safe on this phone. Please contact support."

export function SyncBanner() {
  const status = useSyncStatus()
  const supportEmail = getSupportEmail()

  if (status.kind === 'synced') return null

  if (status.kind === 'pending') {
    return (
      <div className="sync-banner sync-banner--pending" role="status">
        Saving your updates…
      </div>
    )
  }

  if (status.kind === 'offline') {
    return (
      <div className="sync-banner sync-banner--offline" role="status">
        No internet right now. Your work is safe on this phone.
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
