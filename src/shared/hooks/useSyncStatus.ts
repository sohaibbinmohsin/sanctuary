import { useEffect, useState } from 'react'
import { usePowerSync } from '@powersync/react'
import { asDb } from '@/shared/lib/db'

export type SyncStatusKind = 'synced' | 'pending' | 'offline' | 'failed'

export function useSyncStatus(): SyncStatusKind {
  const powerSync = usePowerSync()
  const [status, setStatus] = useState<SyncStatusKind>('offline')

  useEffect(() => {
    if (!powerSync) {
      setStatus('offline')
      return
    }
    const db = asDb(powerSync)

    const compute = (): SyncStatusKind => {
      const s = db.currentStatus
      if (!navigator.onLine) return 'offline'
      const flow = s?.dataFlowStatus
      if (flow?.downloadError || flow?.uploadError) return 'failed'
      if (flow?.uploading || flow?.downloading || s?.connecting) {
        return 'pending'
      }
      if (s?.connected === false) {
        return navigator.onLine ? 'failed' : 'offline'
      }
      return 'synced'
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
