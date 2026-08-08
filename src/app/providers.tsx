import { type ReactNode, useEffect, useState } from 'react'
import { PowerSyncContext } from '@powersync/react'
import {
  getPowerSyncDb,
  connectPowerSync,
} from '@/features/sync/powersync/database'
import { ensurePlaygroundSeed } from '@/features/playground/seed'
import { setPlaygroundMode } from '@/features/playground/mode'
import { supabase, supabaseConfigured } from '@/shared/lib/supabase'
import { ConfirmProvider } from '@/shared/ui/ConfirmDialog'

type ProvidersProps = {
  children: ReactNode
  sessionReady: boolean
  playground?: boolean
}

export function Providers({
  children,
  sessionReady,
  playground = false,
}: ProvidersProps) {
  const [db] = useState(() => getPowerSyncDb({ playground }))
  const [playgroundReady, setPlaygroundReady] = useState(!playground)

  useEffect(() => {
    setPlaygroundMode(playground)
  }, [playground])

  useEffect(() => {
    if (!playground) return
    let cancelled = false
    void (async () => {
      try {
        await ensurePlaygroundSeed(db)
      } finally {
        if (!cancelled) setPlaygroundReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playground, db])

  useEffect(() => {
    if (playground || !sessionReady || !supabaseConfigured) return
    void connectPowerSync().catch((err) => {
      console.warn(
        'PowerSync connect failed. Check VITE_POWERSYNC_URL, Client Auth (Supabase JWT), and sync rules.',
        err,
      )
    })
  }, [sessionReady, playground])

  if (playground && !playgroundReady) {
    return (
      <main className="login-screen">
        <h1 className="brand">Sanctuary</h1>
        <p className="muted">Loading playground…</p>
      </main>
    )
  }

  return (
    <PowerSyncContext.Provider value={db}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </PowerSyncContext.Provider>
  )
}

export async function hasActiveSession(): Promise<boolean> {
  if (!supabaseConfigured) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}
