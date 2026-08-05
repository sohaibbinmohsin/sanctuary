import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Providers, hasActiveSession } from '@/app/providers'
import { AppShell } from '@/app/router'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { supabase, supabaseConfigured } from '@/shared/lib/supabase'

export default function App() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const session = await hasActiveSession()
      if (mounted) {
        setSignedIn(session)
        setReady(true)
      }
    })()

    if (!supabaseConfigured) {
      return () => {
        mounted = false
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!ready) {
    return (
      <main className="login-screen">
        <h1 className="brand">Sanctuary</h1>
        <p>Loading…</p>
      </main>
    )
  }

  return (
    <Providers sessionReady={signedIn}>
      <BrowserRouter>
        {signedIn ? (
          <AppShell />
        ) : (
          <LoginScreen onSuccess={() => setSignedIn(true)} />
        )}
      </BrowserRouter>
    </Providers>
  )
}
