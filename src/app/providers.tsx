import { type ReactNode, useEffect, useState } from 'react'
import { PowerSyncContext } from '@powersync/react'
import {
  getPowerSyncDb,
  connectPowerSync,
} from '@/features/sync/powersync/database'
import { supabase, supabaseConfigured } from '@/shared/lib/supabase'

type ProvidersProps = {
  children: ReactNode
  sessionReady: boolean
}

export function Providers({ children, sessionReady }: ProvidersProps) {
  const [db] = useState(() => getPowerSyncDb())

  useEffect(() => {
    if (!sessionReady || !supabaseConfigured) return
    void connectPowerSync().catch((err) => {
      console.warn(
        'PowerSync connect failed. Check VITE_POWERSYNC_URL, Client Auth (Supabase JWT), and sync rules.',
        err,
      )
    })
  }, [sessionReady])

  return (
    <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>
  )
}

export async function hasActiveSession(): Promise<boolean> {
  if (!supabaseConfigured) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}
