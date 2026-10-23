import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import { usePwaUpdate } from '@/shared/lib/pwa/pwaUpdateContext'

export function PwaUpdateModal() {
  const {
    hasUpdate,
    isCritical,
    modalOpen,
    refreshing,
    statusMessage,
    closeModal,
    applyUpdate,
  } = usePwaUpdate()

  if (!hasUpdate || !modalOpen) return null

  return (
    <ResponsiveSheetModal
      isOpen={modalOpen}
      onClose={closeModal}
      closeable={!isCritical}
      title={isCritical ? 'Critical Update Required' : 'Update Available'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ margin: 0, color: 'var(--color-ink, #1a2e22)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          {isCritical
            ? 'This update contains critical security or system fixes. Please update now to continue using Sanctuary.'
            : 'A new version of Sanctuary is available with improvements and fixes. Your offline records and edits are completely safe on this device.'}
        </p>

        {statusMessage && statusMessage !== 'Updating…' ? (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm, 8px)',
              background: 'var(--color-forest-soft, #e3ede6)',
              color: 'var(--color-forest, #2f5d3a)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="responsive-modal__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={refreshing}
            onClick={() => void applyUpdate()}
          >
            {refreshing ? 'Updating…' : 'Update now'}
          </button>
          {!isCritical ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={refreshing}
              onClick={closeModal}
            >
              Later
            </button>
          ) : null}
        </div>
      </div>
    </ResponsiveSheetModal>
  )
}
