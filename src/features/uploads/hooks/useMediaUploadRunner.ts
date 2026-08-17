import { useEffect } from 'react'
import { processPhotoQueue } from '@/features/photos/domain/photos'
import { processLedgerAttachmentQueue } from '@/features/ledger/domain/attachments'
import { isPlaygroundMode } from '@/features/playground/mode'
import type { SanctuaryDb } from '@/shared/lib/db'
import { notifyPendingMediaChanged } from '@/shared/lib/pendingMedia'

const TICK_MS = 15_000

export async function runMediaQueues(db: SanctuaryDb): Promise<void> {
  if (isPlaygroundMode()) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyPendingMediaChanged()
    return
  }
  await processPhotoQueue(db)
  await processLedgerAttachmentQueue(db)
  notifyPendingMediaChanged()
}

/** Drain photo and ledger proof queues while the signed-in app is open. */
export function useMediaUploadRunner(db: SanctuaryDb | null): void {
  useEffect(() => {
    if (!db || isPlaygroundMode()) return

    const tick = () => {
      void runMediaQueues(db)
    }
    tick()
    const id = window.setInterval(tick, TICK_MS)
    window.addEventListener('online', tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('online', tick)
    }
  }, [db])
}
