import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { useDb } from '@/shared/hooks/useDb'
import { disconnectPowerSync } from '@/features/sync/powersync/database'
import { supabaseConnector } from '@/features/sync/powersync/connector'
import { supabase } from '@/shared/lib/supabase'
import {
  DEFAULT_ONBOARDING_STATUSES,
  DEFAULT_ONBOARDING_CATEGORIES,
  commitOnboarding,
  type StatusDraft,
  type CategoryDraft,
} from '@/features/onboarding/domain/onboarding'
import {
  OnboardingProgress,
  type OnboardingStep,
} from '@/features/onboarding/components/OnboardingProgress'
import { StepIdentity } from '@/features/onboarding/components/StepIdentity'
import { StepStatuses } from '@/features/onboarding/components/StepStatuses'
import { StepLedger } from '@/features/onboarding/components/StepLedger'
import '@/features/onboarding/onboarding.css'

export function OnboardingScreen() {
  const navigate = useNavigate()
  const db = useDb()
  const { member } = useCurrentMember()

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)
  const [name, setName] = useState(member?.orgName ?? '')
  const [initials, setInitials] = useState(member?.orgInitials ?? '')
  const [currency, setCurrency] = useState(member?.currency ?? 'PKR')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [statuses, setStatuses] = useState<StatusDraft[]>(() =>
    DEFAULT_ONBOARDING_STATUSES.map((s) => ({ ...s, id: crypto.randomUUID() })),
  )
  const [categories, setCategories] = useState<CategoryDraft[]>(() =>
    DEFAULT_ONBOARDING_CATEGORIES.map((c) => ({ ...c, id: crypto.randomUUID() })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentStep])

  async function handleSignOut() {
    await disconnectPowerSync()
    await supabaseConnector.logout()
    window.location.assign('/')
  }

  async function handleFinish() {
    if (!db) return
    let targetOrgId = member?.orgId
    let targetUserId = member?.userId

    if (!targetOrgId || !targetUserId) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      targetUserId = session?.user?.id
      if (!targetUserId) {
        setError('You are not signed in.')
        return
      }
      targetOrgId = targetOrgId || crypto.randomUUID()
    }

    setBusy(true)
    setError(null)
    try {
      await commitOnboarding(db, {
        orgId: targetOrgId,
        userId: targetUserId,
        name,
        initials,
        currency,
        logoFile,
        statuses,
        categories,
      })
      navigate('/animals', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not complete shelter setup. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding-screen">
      <header className="onboarding-screen__header">
        <div className="onboarding-screen__brand-lockup">
          <img
            className="onboarding-screen__logo"
            src="/sanctuary-logo.svg"
            alt=""
            width={36}
            height={36}
          />
          <span className="onboarding-screen__brand">Sanctuary</span>
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          style={{ height: '2.25rem', minHeight: '2.25rem', padding: '0 0.85rem' }}
          onClick={() => void handleSignOut()}
        >
          <SignOut size={16} weight="bold" aria-hidden />
          <span>Sign out</span>
        </button>
      </header>

      <main className="onboarding-screen__main">
        <div className="onboarding-screen__container">
          <div className="onboarding-screen__welcome">
            <h1>Welcome to Sanctuary</h1>
            <p>
              On behalf of{' '}
              <a
                href="https://themohsinproject.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  whiteSpace: 'nowrap',
                  textDecoration: 'underline',
                  color: 'inherit',
                  textUnderlineOffset: '3px',
                }}
              >
                The Mohsin Project Global{' '}
                <img
                  src="/mohsin-project-logo.svg"
                  alt="The Mohsin Project"
                  style={{ height: '1.2em', verticalAlign: '-0.18em', display: 'inline-block' }}
                />
              </a>
              , we are thrilled to have you here. Let's get your shelter set up.
            </p>
          </div>

          <OnboardingProgress currentStep={currentStep} />

          <div className="onboarding-card">
            {currentStep === 1 && (
              <StepIdentity
                name={name}
                initials={initials}
                logoFile={logoFile}
                onNameChange={setName}
                onInitialsChange={setInitials}
                onLogoFileChange={setLogoFile}
                onNext={() => setCurrentStep(2)}
              />
            )}

            {currentStep === 2 && (
              <StepStatuses
                statuses={statuses}
                onStatusesChange={setStatuses}
                onBack={() => setCurrentStep(1)}
                onNext={() => setCurrentStep(3)}
              />
            )}

            {currentStep === 3 && (
              <StepLedger
                currency={currency}
                onCurrencyChange={setCurrency}
                categories={categories}
                onCategoriesChange={setCategories}
                onBack={() => setCurrentStep(2)}
                onFinish={() => void handleFinish()}
                busy={busy}
                error={error}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
