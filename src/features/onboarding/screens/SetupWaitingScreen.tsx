import { useState } from 'react'
import { disconnectPowerSync } from '@/features/sync/powersync/database'
import { supabaseConnector } from '@/features/sync/powersync/connector'
import { Button } from '@/shared/ui/Button'
import '@/features/onboarding/onboarding.css'

export type SetupWaitingScreenProps = {
  onSignOut?: () => void | Promise<void>
}

export function SetupWaitingScreen({ onSignOut }: SetupWaitingScreenProps) {
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    try {
      if (onSignOut) {
        await onSignOut()
        return
      }
      await disconnectPowerSync()
      await supabaseConnector.logout()
      window.location.assign('/')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="setup-waiting-screen">
      <div className="setup-waiting-card">
        <img
          className="setup-waiting-logo"
          src="/sanctuary-logo.svg"
          alt=""
          width={52}
          height={52}
        />
        <div className="stack" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <h1 className="brand" style={{ fontSize: 'var(--text-xl)', margin: 0 }}>
            Sanctuary
          </h1>
          <p className="subheading" style={{ margin: 0 }}>
            Animal welfare platform
          </p>
        </div>
        <p className="setup-waiting-message">
          Your shelter’s account is currently being set up by an administrator. Please check back shortly.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void handleSignOut()}
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </main>
  )
}
