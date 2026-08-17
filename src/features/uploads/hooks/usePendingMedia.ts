import { useCallback, useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'
import {
  listPendingMediaOnThisDevice,
  type PendingMediaItem,
} from '@/features/uploads/domain/pendingMedia'
import { runMediaQueues } from '@/features/uploads/hooks/useMediaUploadRunner'
import { PENDING_MEDIA_EVENT } from '@/shared/lib/pendingMedia'
import { isPlaygroundMode } from '@/features/playground/mode'

export function usePendingMedia(orgId: string | undefined): {
  items: PendingMediaItem[]
  failedCount: number
  loading: boolean
  retrying: boolean
  retry: () => Promise<void>
} {
  const db = useDb()
  const sync = useSyncStatus()
  const [items, setItems] = useState<PendingMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    if (!db || !orgId || isPlaygroundMode()) {
      setItems([])
      setLoading(false)
      return
    }
    try {
      setItems(await listPendingMediaOnThisDevice(db, orgId))
    } catch (err) {
      console.warn('Pending media list failed', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [db, orgId])

  useEffect(() => {
    void load()
  }, [load, sync.kind])

  useEffect(() => {
    function onChange() {
      void load()
    }
    window.addEventListener(PENDING_MEDIA_EVENT, onChange)
    return () => window.removeEventListener(PENDING_MEDIA_EVENT, onChange)
  }, [load])

  const retry = useCallback(async () => {
    if (!db) return
    setRetrying(true)
    try {
      await runMediaQueues(db)
      await load()
    } finally {
      setRetrying(false)
    }
  }, [db, load])

  const failedCount = items.filter((item) => item.state === 'failed').length

  return { items, failedCount, loading, retrying, retry }
}
