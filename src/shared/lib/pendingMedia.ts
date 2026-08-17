/** Fired when local photo/proof queues change so the Uploads UI can refresh. */
export const PENDING_MEDIA_EVENT = 'sanctuary:pending-media'

export function notifyPendingMediaChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PENDING_MEDIA_EVENT))
}
