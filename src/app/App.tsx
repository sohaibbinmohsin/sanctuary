import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Providers, hasActiveSession } from '@/app/providers'
import { AppShell } from '@/app/router'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { LandingScreen } from '@/features/landing/LandingScreen'
import { PublicShelterScreen } from '@/features/public/screens/PublicShelterScreen'
import { isPlaygroundPath } from '@/features/playground/mode'
import { isReservedPublicSlug } from '@/shared/lib/public/slug'
import { supabase, supabaseConfigured } from '@/shared/lib/supabase'
import { PwaUpdateBanner } from '@/shared/ui/PwaUpdateBanner'

const playground = isPlaygroundPath(window.location.pathname)

/** First path segments owned by the signed-in app shell, so /:slug can still resolve to it. */
const APP_ROOTS = new Set(['animals', 'ledger', 'dashboard', 'settings', 'checklist', 'uploads'])

/**
 * Signed-in staff may still want to preview a donor-facing `/{slug}` page.
 * Renders the app shell for known app paths, and the public page otherwise.
 */
function PublicSlugOrApp() {
  const location = useLocation()
  const firstSegment = location.pathname.split('/')[1] ?? ''

  if (isReservedPublicSlug(firstSegment) || APP_ROOTS.has(firstSegment)) {
    return <AppShell />
  }

  // The signed-in route is `/*`, so there is no `:slug` param to read.
  return <PublicShelterScreen slug={firstSegment} />
}

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

  let tree
  if (!ready) {
    tree = (
      <main className="boot-screen" aria-busy="true" aria-live="polite">
        <div className="boot-screen__content">
          <div className="boot-screen__brand-lockup">
            <img
              className="boot-screen__logo"
              src="/sanctuary-mark.svg"
              alt=""
              width={88}
              height={88}
            />
            <div className="boot-screen__brand-text">
              <h1 className="brand">Sanctuary</h1>
              <p className="subheading">Animal welfare platform</p>
            </div>
          </div>
        </div>
        <div className="boot-screen__footer">
          <span>Free software by The Mohsin Project</span>
          <img src="/mohsin-project-logo-white.svg" alt="" height={18} />
        </div>
      </main>
    )
  } else if (playground) {
    tree = (
      <Providers sessionReady={false} playground>
        <BrowserRouter basename="/playground">
          <AppShell />
        </BrowserRouter>
      </Providers>
    )
  } else {
    tree = (
      <Providers sessionReady={signedIn}>
        <BrowserRouter>
          {signedIn ? (
            <Routes>
              <Route path="/login" element={<Navigate to="/animals" replace />} />
              <Route path="/*" element={<PublicSlugOrApp />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<LandingScreen />} />
              <Route
                path="/login"
                element={<LoginScreen onSuccess={() => setSignedIn(true)} />}
              />
              <Route path="/:slug" element={<PublicShelterScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </BrowserRouter>
      </Providers>
    )
  }

  return (
    <>
      <PwaUpdateBanner />
      {tree}
    </>
  )
}
