import { CloudArrowUp } from '@phosphor-icons/react'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { usePendingMedia } from '@/features/uploads/hooks/usePendingMedia'
import {
  pendingUploadsBody,
  pendingUploadsHeadline,
} from '@/features/uploads/domain/pendingMedia'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import { Button } from '@/shared/ui/Button'

export function OverviewUploadsCard() {
  const { member } = useCurrentMember()
  const sync = useSyncStatus()
  const { items, failedCount, loading } = usePendingMedia(member?.orgId)

  if (loading && items.length === 0) return null
  if (items.length === 0) return null

  const online = sync.kind !== 'offline'
  const failed = failedCount > 0

  return (
    <section
      className="overview-panel overview-uploads"
      aria-labelledby="overview-uploads-title"
    >
      <h2 id="overview-uploads-title">Uploads</h2>
      <div
        className={
          failed
            ? 'panel panel--soft upload-summary upload-summary--failed'
            : 'panel panel--soft upload-summary'
        }
      >
        <div className="upload-summary__icon" aria-hidden>
          <CloudArrowUp size={28} weight="duotone" />
        </div>
        <div className="upload-summary__copy">
          <p className="upload-summary__value">
            {pendingUploadsHeadline(items.length, failedCount)}
          </p>
          <p className="muted">{pendingUploadsBody(online)}</p>
        </div>
        <Button to="/uploads" variant={failed ? 'accent' : 'secondary'}>
          View
        </Button>
      </div>
    </section>
  )
}
