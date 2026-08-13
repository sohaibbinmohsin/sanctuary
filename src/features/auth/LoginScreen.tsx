import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, EyeSlash } from '@phosphor-icons/react'
import { supabaseConnector } from '@/features/sync/powersync/connector'
import { connectPowerSync } from '@/features/sync/powersync/database'
import { supabaseConfigured } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/Button'
import { Field, TextField } from '@/shared/ui/Field'

type LoginScreenProps = {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (!supabaseConfigured) {
        throw new Error(
          'Sanctuary is not set up yet. Ask your admin to finish setup.',
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
      setError(
        err instanceof Error
          ? err.message
          : 'Could not sign in. Check your email and password.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-screen">
      <Link className="login-screen__back" to="/">
        <ArrowLeft size={18} weight="bold" aria-hidden />
        Back
      </Link>

      <div className="login-screen__panel">
        <div className="login-screen__body">
          <img
            className="login-screen__logo"
            src="/favicon.svg"
            alt=""
            width={44}
            height={44}
          />
          <h1 className="brand">Sanctuary</h1>
          <p className="lede">
            Sign in to care for your animals and keep shelter records in one place.
          </p>
          <form onSubmit={onSubmit} className="login-form">
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field label="Password" htmlFor="login-password">
              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeSlash size={20} weight="bold" aria-hidden />
                  ) : (
                    <Eye size={20} weight="bold" aria-hidden />
                  )}
                </button>
              </div>
            </Field>
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" variant="primary" block disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="login-screen__access">
            New shelter?{' '}
            <a
              href="https://www.themohsinproject.org/#apply?type=partner"
              target="_blank"
              rel="noopener noreferrer"
            >
              Request access
            </a>
          </p>
        </div>

        <footer className="login-screen__foot">
          <a
            className="mohsin-credit"
            href="https://themohsinproject.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Free software by</span>
            <span className="mohsin-credit__name">The Mohsin Project</span>
            <img
              src="/mohsin-project-logo.svg"
              alt=""
              width={88}
              height={50}
            />
          </a>
        </footer>
      </div>
    </main>
  )
}
