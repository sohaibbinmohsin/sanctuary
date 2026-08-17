import { CloudArrowUp, ImageSquare, Receipt, WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { usePendingMedia } from '@/features/uploads/hooks/usePendingMedia'
import {
  pendingUploadsBody,
  pendingUploadsHeadline,
} from '@/features/uploads/domain/pendingMedia'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

export function UploadsScreen() {
  const { member } = useCurrentMember()
  const sync = useSyncStatus()
  const { items, failedCount, loading, retrying, retry } = usePendingMedia(
    member?.orgId,
  )
  const online = sync.kind !== 'offline'

  const isEmpty = !loading && items.length === 0

  return (
    <section className={isEmpty ? 'screen screen--empty' : 'screen'}>
      <PageHeader
        title="Uploads"
        subtitle={
          items.length === 0
            ? 'Photos and receipts send while this app is open.'
            : pendingUploadsBody(online)
        }
        backTo="/dashboard"
        backLabel="Overview"
        hideBackOnDesktop
        actionsOnBackRow
        actions={
          items.length > 0 ? (
            <Button
              type="button"
              variant="accent"
              onClick={() => void retry()}
              disabled={retrying || !online}
            >
              {retrying ? 'Sending…' : online ? 'Send now' : 'Waiting for internet'}
            </Button>
          ) : undefined
        }
      />

      {loading && items.length === 0 ? (
        <p className="muted">Checking this phone…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CloudArrowUp size={28} weight="duotone" />}
          title="Nothing waiting"
          body="When a photo or receipt is still on this phone, it will show up here and send in the background."
        />
      ) : (
        <ul className="upload-list">
          {items.map((item) => {
            const Icon = item.kind === 'photo' ? ImageSquare : Receipt
            const failed = item.state === 'failed'
            return (
              <li key={item.id}>
                <Link
                  className={
                    failed
                      ? 'upload-list__row upload-list__row--failed'
                      : 'upload-list__row'
                  }
                  to={item.href}
                >
                  <span className="upload-list__icon" aria-hidden>
                    {failed ? (
                      <WarningCircle size={22} weight="fill" />
                    ) : (
                      <Icon size={22} weight="duotone" />
                    )}
                  </span>
                  <span className="upload-list__copy">
                    <strong>{item.title}</strong>
                    <span className="muted">{item.subtitle}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {failedCount > 0 ? (
        <p className="muted upload-list__hint">
          {pendingUploadsHeadline(items.length, failedCount)}. Keep this phone
          online with the app open to retry.
        </p>
      ) : null}
    </section>
  )
}
