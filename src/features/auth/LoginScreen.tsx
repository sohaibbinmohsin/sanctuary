import { type FormEvent, useState } from 'react'
import { supabaseConnector } from '@/features/sync/powersync/connector'
import { connectPowerSync } from '@/features/sync/powersync/database'
import { supabaseConfigured } from '@/shared/lib/supabase'

type LoginScreenProps = {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (!supabaseConfigured) {
        throw new Error(
          'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        )
      }
      await supabaseConnector.login(email.trim(), password)
      try {
        await connectPowerSync()
      } catch (connectErr) {
        console.warn('PowerSync connect after login failed:', connectErr)
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-screen">
      <h1 className="brand">Sanctuary</h1>
      <p className="lede">Sign in to manage your shelter records.</p>
      <form onSubmit={onSubmit} className="login-form">
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
