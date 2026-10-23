import { usePwaUpdate } from '@/shared/lib/pwa/pwaUpdateContext'

export function PwaUpdatePill() {
  const { hasUpdate, modalOpen, isCritical, openModal } = usePwaUpdate()

  // Only show the pill when an update exists and the modal is closed
  if (!hasUpdate || modalOpen) return null

  return (
    <button
      type="button"
      className={`pwa-update-pill ${isCritical ? 'pwa-update-pill--critical' : ''}`}
      onClick={openModal}
      title="Update available — click to view details"
      aria-label="Update available. Click to view details."
    >
      <span className="pwa-update-pill__dot" aria-hidden="true" />
      <span>Update available</span>
    </button>
  )
}
