import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Providers, hasActiveSession } from '@/app/providers'
import { AppShell } from '@/app/router'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { LandingScreen } from '@/features/landing/LandingScreen'
import { isPlaygroundPath } from '@/features/playground/mode'
import { supabase, supabaseConfigured } from '@/shared/lib/supabase'

const playground = isPlaygroundPath(window.location.pathname)

export default function App() {
  const [ready, setReady] = useState(playground)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    if (playground) return

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
        <p className="muted">Getting things ready…</p>
      </main>
    )
  }

  if (playground) {
    return (
      <Providers sessionReady={false} playground>
        <BrowserRouter basename="/playground">
          <AppShell />
        </BrowserRouter>
      </Providers>
    )
  }

  return (
    <Providers sessionReady={signedIn}>
      <BrowserRouter>
        {signedIn ? (
          <Routes>
            <Route path="/login" element={<Navigate to="/animals" replace />} />
            <Route path="*" element={<AppShell />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<LandingScreen />} />
            <Route
              path="/login"
              element={<LoginScreen onSuccess={() => setSignedIn(true)} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </BrowserRouter>
    </Providers>
  )
}
