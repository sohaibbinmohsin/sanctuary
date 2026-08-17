import { useEffect, useState } from 'react'
import { usePowerSync } from '@powersync/react'
import { asDb } from '@/shared/lib/db'
import { isPlaygroundMode } from '@/features/playground/mode'

export type SyncStatusKind = 'synced' | 'pending' | 'offline' | 'failed'

export type SyncStatus = {
  kind: SyncStatusKind
  errorMessage: string | null
  /** False until PowerSync has completed at least one download into local DB. */
  hasSynced: boolean
  downloading: boolean
  uploading: boolean
}

function errorText(err: unknown): string | null {
  if (!err) return null
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export function useSyncStatus(): SyncStatus {
  const powerSync = usePowerSync()
  const [status, setStatus] = useState<SyncStatus>({
    kind: 'pending',
    errorMessage: null,
    hasSynced: false,
    downloading: false,
    uploading: false,
  })

  useEffect(() => {
    if (isPlaygroundMode()) {
      setStatus({
        kind: 'synced',
        errorMessage: null,
        hasSynced: true,
        downloading: false,
        uploading: false,
      })
      return
    }
    if (!powerSync) {
      setStatus({
        kind: 'pending',
        errorMessage: null,
        hasSynced: false,
        downloading: false,
        uploading: false,
      })
      return
    }
    const db = asDb(powerSync)

    const compute = (): SyncStatus => {
      const s = db.currentStatus
      const flow = s?.dataFlowStatus
      const hasSynced = Boolean(s?.hasSynced)
      const downloading = Boolean(s?.connecting || flow?.downloading)
      const uploading = Boolean(flow?.uploading)

      if (!navigator.onLine) {
        return {
          kind: 'offline',
          errorMessage: null,
          hasSynced,
          downloading: false,
          uploading: false,
        }
      }

      const downloadErr = errorText(flow?.downloadError)
      const uploadErr = errorText(flow?.uploadError)

      if (downloadErr || uploadErr) {
        return {
          kind: 'failed',
          errorMessage: downloadErr || uploadErr,
          hasSynced,
          downloading,
          uploading,
        }
      }

      if (s?.connecting || flow?.uploading || flow?.downloading) {
        return {
          kind: 'pending',
          errorMessage: null,
          hasSynced,
          downloading,
          uploading,
        }
      }

      if (s?.connected) {
        return {
          kind: 'synced',
          errorMessage: null,
          hasSynced,
          downloading: false,
          uploading: false,
        }
      }

      return {
        kind: 'pending',
        errorMessage: null,
        hasSynced,
        downloading,
        uploading,
      }
    }

    setStatus(compute())
    const unsubscribe = db.registerListener?.({
      statusChanged: () => setStatus(compute()),
    })

    const onOnline = () => setStatus(compute())
    const onOffline = () =>
      setStatus((prev) => ({
        kind: 'offline',
        errorMessage: null,
        hasSynced: prev.hasSynced,
        downloading: false,
        uploading: false,
      }))
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
