import { useEffect, useState } from 'react'
import { usePowerSync } from '@powersync/react'
import { asDb } from '@/shared/lib/db'

export type SyncStatusKind = 'synced' | 'pending' | 'offline' | 'failed'

export function useSyncStatus(): SyncStatusKind {
  const powerSync = usePowerSync()
  const [status, setStatus] = useState<SyncStatusKind>('pending')

  useEffect(() => {
    if (!powerSync) {
      setStatus('pending')
      return
    }
    const db = asDb(powerSync)

    const compute = (): SyncStatusKind => {
      if (!navigator.onLine) return 'offline'

      const s = db.currentStatus
      const flow = s?.dataFlowStatus

      // Only treat as hard failure when PowerSync reports an error
      if (flow?.downloadError || flow?.uploadError) return 'failed'

      if (s?.connecting || flow?.uploading || flow?.downloading) {
        return 'pending'
      }

      if (s?.connected) return 'synced'

      // Online but not connected yet (connect in progress / not started) —
      // do not show the alarmist "contact support" banner.
      return 'pending'
    }

    setStatus(compute())
    const unsubscribe = db.registerListener?.({
      statusChanged: () => setStatus(compute()),
    })

    const onOnline = () => setStatus(compute())
    const onOffline = () => setStatus('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      unsubscribe?.()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [powerSync])

  return status
}
