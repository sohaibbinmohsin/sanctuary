import { Check } from '@phosphor-icons/react'

export type OnboardingStep = 1 | 2 | 3

export type OnboardingProgressProps = {
  currentStep: OnboardingStep
}

const STEPS = [
  { step: 1 as const, label: 'Identity' },
  { step: 2 as const, label: 'Statuses' },
  { step: 3 as const, label: 'Ledger' },
]

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <nav aria-label="Onboarding progress" className="onboarding-progress">
      <ol className="onboarding-progress__steps">
        {STEPS.map(({ step, label }) => {
          const isCurrent = step === currentStep
          const isCompleted = step < currentStep
          return (
            <li
              key={step}
              className={[
                'onboarding-progress__step',
                isCurrent ? 'onboarding-progress__step--current' : '',
                isCompleted ? 'onboarding-progress__step--completed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`Step ${step}: ${label}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="onboarding-progress__badge" aria-hidden>
                {isCompleted ? (
                  <Check size={14} weight="bold" />
                ) : (
                  <span>{step}</span>
                )}
              </div>
              <span className="onboarding-progress__label">{label}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
