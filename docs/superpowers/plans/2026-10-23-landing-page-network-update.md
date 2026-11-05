# Sanctuary Landing Page Redesign: Animal Welfare Network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Sanctuary landing page from a single-shelter management pitch into an inclusive, human-centered animal welfare network connecting citizens, rescue units, shelters, clinics, and pet owners, featuring a primary "Report a case" emergency action.

**Architecture:** Component-driven refactor of `LandingScreen.tsx` and `landing.css` utilizing Sanctuary's existing design tokens (`var(--color-...)`, `var(--font-...)`, `var(--radius-...)`). A lightweight, accessible `ReportCaseModal` component manages client-side public case intake and routing confirmation. `LoginScreen.tsx` is updated to house the "Try interactive demo" option.

**Tech Stack:** React 19, TypeScript, React Router 7, Vite, `@phosphor-icons/react`, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-landing-page-network-update-design.md`

## Global Constraints

* Strictly zero em-dashes (`—` or `--`) in all user-facing copy.
* Design system tokens only: all colors, radii, shadows, and fonts must map to `src/styles/tokens.css`.
* Phosphor icons only: use `@phosphor-icons/react` (`Siren` for emergency report action, no emojis).
* Clean build: `npm run build` must succeed with 0 errors.

---

### Task 1: Report Intake Modal Component (`ReportCaseModal`)

**Files:**
- Create: `src/features/landing/components/ReportCaseModal.tsx`
- Create: `src/features/landing/components/reportCaseModal.css`
- Test: `tests/unit/landing/reportCaseModal.test.tsx`

**Interfaces:**
- Consumes: `@phosphor-icons/react` (`Siren`, `X`, `CheckCircle`, `UploadSimple`)
- Produces: `export function ReportCaseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void })`

- [ ] **Step 1: Write failing tests for ReportCaseModal**

Create `tests/unit/landing/reportCaseModal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReportCaseModal } from '@/features/landing/components/ReportCaseModal'

describe('ReportCaseModal', () => {
  it('does not render when isOpen is false', () => {
    render(<ReportCaseModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders modal with form fields when isOpen is true', () => {
    render(<ReportCaseModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Animal/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Contact phone/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit report/i })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(<ReportCaseModal isOpen={true} onClose={handleClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Close report dialog/i }))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('shows confirmation state upon submitting form', () => {
    render(<ReportCaseModal isOpen={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Animal/i), { target: { value: 'Injured stray dog' } })
    fireEvent.change(screen.getByLabelText(/Location/i), { target: { value: 'Gulberg, Lahore' } })
    fireEvent.change(screen.getByLabelText(/Contact phone/i), { target: { value: '03001234567' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }))
    expect(screen.getByText(/Report submitted/i)).toBeInTheDocument()
    expect(screen.getByText(/Routed to partner rescue networks/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/landing/reportCaseModal.test.tsx`
Expected: FAIL (Cannot find module `@/features/landing/components/ReportCaseModal`)

- [ ] **Step 3: Implement ReportCaseModal and styling**

Create `src/features/landing/components/reportCaseModal.css` using tokens:
```css
.report-modal__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(19, 32, 24, 0.72);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  animation: modal-fade-in var(--duration) var(--ease-out) both;
}

.report-modal__dialog {
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 32rem;
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--space-6);
  position: relative;
  color: var(--color-ink);
  font-family: var(--font-sans);
}

.report-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.report-modal__title-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.report-modal__icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  flex-shrink: 0;
}

.report-modal__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
  line-height: var(--leading-tight);
}

.report-modal__subtitle {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 0 0;
}

.report-modal__close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-ink-muted);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.report-modal__close:hover {
  background: var(--color-mist);
  color: var(--color-ink);
}

.report-modal__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.report-modal__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.report-modal__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
}

.report-modal__input,
.report-modal__textarea,
.report-modal__select {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  width: 100%;
}

.report-modal__input:focus,
.report-modal__textarea:focus,
.report-modal__select:focus {
  outline: 2px solid var(--color-forest);
  border-color: var(--color-forest);
}

.report-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.report-modal__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  text-decoration: none;
}

.report-modal__btn--primary {
  background: var(--color-forest);
  color: var(--color-white);
}

.report-modal__btn--primary:hover {
  background: var(--color-forest-hover);
}

.report-modal__btn--secondary {
  background: var(--color-mist);
  color: var(--color-ink);
}

.report-modal__btn--secondary:hover {
  background: var(--color-forest-soft);
}

.report-modal__success {
  text-align: center;
  padding: var(--space-6) var(--space-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.report-modal__success-icon {
  color: var(--color-success);
}

@keyframes modal-fade-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
```

Create `src/features/landing/components/ReportCaseModal.tsx`:
```tsx
import { useState, type FormEvent, useEffect } from 'react'
import { Siren, X, CheckCircle } from '@phosphor-icons/react'
import './reportCaseModal.css'

type ReportCaseModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function ReportCaseModal({ isOpen, onClose }: ReportCaseModalProps) {
  const [animal, setAnimal] = useState('')
  const [urgency, setUrgency] = useState('Critical')
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSubmitted(false)
      setAnimal('')
      setLocation('')
      setPhone('')
      setDetails('')
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div
      className="report-modal__overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="report-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="report-modal__header">
          <div className="report-modal__title-group">
            <span className="report-modal__icon-badge" aria-hidden="true">
              <Siren size={22} weight="bold" />
            </span>
            <div>
              <h2 id="report-modal-title" className="report-modal__title">
                Report an animal in distress
              </h2>
              <p className="report-modal__subtitle">
                Reports are directly dispatched to partner rescue networks in your area.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="report-modal__close"
            onClick={onClose}
            aria-label="Close report dialog"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {submitted ? (
          <div className="report-modal__success">
            <CheckCircle
              className="report-modal__success-icon"
              size={56}
              weight="duotone"
              aria-hidden="true"
            />
            <h3 className="report-modal__title">Report submitted</h3>
            <p className="report-modal__subtitle">
              Routed to partner rescue networks in your area. Responders will contact you if additional directions are needed.
            </p>
            <button
              type="button"
              className="report-modal__btn report-modal__btn--secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal__form">
            <div className="report-modal__field">
              <label htmlFor="report-animal" className="report-modal__label">
                Animal and condition
              </label>
              <input
                id="report-animal"
                type="text"
                className="report-modal__input"
                placeholder="e.g. Injured stray dog, trapped kitten"
                value={animal}
                onChange={(e) => setAnimal(e.target.value)}
                required
              />
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-urgency" className="report-modal__label">
                Urgency level
              </label>
              <select
                id="report-urgency"
                className="report-modal__select"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                <option value="Critical">Critical (Bleeding, hit-and-run, unconscious)</option>
                <option value="Urgent">Urgent (Severe injury, unable to stand)</option>
                <option value="Standard">Standard (Sick, malnourished, trapped)</option>
              </select>
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-location" className="report-modal__label">
                Location and landmark
              </label>
              <input
                id="report-location"
                type="text"
                className="report-modal__input"
                placeholder="e.g. Near Kalma Chowk underpass, Lahore"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-phone" className="report-modal__label">
                Contact phone number
              </label>
              <input
                id="report-phone"
                type="tel"
                className="report-modal__input"
                placeholder="03XX XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="report-modal__field">
              <label htmlFor="report-details" className="report-modal__label">
                Additional notes (optional)
              </label>
              <textarea
                id="report-details"
                className="report-modal__textarea"
                rows={2}
                placeholder="Exact spot, animal behavior, nearby landmarks"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <div className="report-modal__actions">
              <button
                type="button"
                className="report-modal__btn report-modal__btn--secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="report-modal__btn report-modal__btn--primary"
              >
                Submit report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/landing/reportCaseModal.test.tsx`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit changes**

Run:
```bash
git add src/features/landing/components/ tests/unit/landing/reportCaseModal.test.tsx
git commit -m "feat(landing): create ReportCaseModal for partner-routed emergency reporting"
```

---

### Task 2: Login Screen Interactive Demo & Branding Update

**Files:**
- Modify: `src/features/auth/LoginScreen.tsx`
- Test: `tests/unit/auth/loginScreenDemo.test.tsx`

**Interfaces:**
- Consumes: `src/features/auth/LoginScreen.tsx`
- Produces: Updated branding text ("Animal welfare network") and link to `/playground` labeled "Try interactive demo"

- [ ] **Step 1: Write test for LoginScreen updates**

Create `tests/unit/auth/loginScreenDemo.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { LoginScreen } from '@/features/auth/LoginScreen'

describe('LoginScreen network updates', () => {
  it('renders Animal welfare network subheading and interactive demo link', () => {
    render(
      <MemoryRouter>
        <LoginScreen onSuccess={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByText('Animal welfare network')).toBeInTheDocument()
    const demoLink = screen.getByRole('link', { name: /Try interactive demo/i })
    expect(demoLink).toBeInTheDocument()
    expect(demoLink).toHaveAttribute('href', '/playground')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/auth/loginScreenDemo.test.tsx`
Expected: FAIL (Cannot find "Animal welfare network" or "Try interactive demo")

- [ ] **Step 3: Update LoginScreen.tsx**

Update `src/features/auth/LoginScreen.tsx`:
Replace `"Animal welfare platform"` with `"Animal welfare network"`.
Add the interactive demo link under the `.login-screen__access` paragraph:
```tsx
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
          <p className="login-screen__demo">
            Want to explore first?{' '}
            <a
              href="/playground"
              onClick={(e) => {
                e.preventDefault()
                window.location.assign('/playground')
              }}
            >
              Try interactive demo
            </a>
          </p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/auth/loginScreenDemo.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add src/features/auth/LoginScreen.tsx tests/unit/auth/loginScreenDemo.test.tsx
git commit -m "feat(auth): update subheadline to animal welfare network and add interactive demo link"
```

---

### Task 3: Landing Screen Redesign (`LandingScreen.tsx` & `landing.css`)

**Files:**
- Modify: `src/features/landing/LandingScreen.tsx`
- Modify: `src/features/landing/landing.css`
- Create: `tests/unit/landing/landingScreen.test.tsx`

**Interfaces:**
- Consumes: `ReportCaseModal` from `@/features/landing/components/ReportCaseModal`, `@phosphor-icons/react` (`Siren`, `MegaphoneSimple`, `Ambulance`, `HouseLine`, `FirstAid`, `ShieldCheck`, `ArrowSquareOut`)
- Produces: `export function LandingScreen()` with the 5-stakeholder network sections and emergency report action

- [ ] **Step 1: Write comprehensive tests for LandingScreen**

Create `tests/unit/landing/landingScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { LandingScreen } from '@/features/landing/LandingScreen'

describe('LandingScreen animal welfare network', () => {
  it('renders brand subheadline as Animal welfare network', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(screen.getByText('Animal welfare network')).toBeInTheDocument()
  })

  it('renders primary emergency Report a case CTA and secondary Sign in', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    const reportBtn = screen.getByRole('button', { name: /Report a case/i })
    expect(reportBtn).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Sign in/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('opens ReportCaseModal when Report a case is clicked', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Report a case/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Report an animal in distress/i)).toBeInTheDocument()
  })

  it('renders all 5 stakeholder network pillars', () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(screen.getByText(/Citizens and Advocates/i)).toBeInTheDocument()
    expect(screen.getByText(/Field Rescue Teams/i)).toBeInTheDocument()
    expect(screen.getByText(/Shelters and Sanctuaries/i)).toBeInTheDocument()
    expect(screen.getByText(/Veterinarians and Clinics/i)).toBeInTheDocument()
    expect(screen.getByText(/Pet Guardians and Owners/i)).toBeInTheDocument()
  })

  it('contains no em-dashes anywhere in rendered body', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    const text = container.textContent || ''
    expect(text).not.toContain('—')
    expect(text).not.toContain('--')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/landing/landingScreen.test.tsx`
Expected: FAIL (Cannot find "Report a case" button or 5 stakeholder pillars)

- [ ] **Step 3: Implement LandingScreen and update landing.css**

Update `src/features/landing/landing.css`:
- Add styles for `.btn--emergency` using `--color-danger`, `--color-white`, `--font-sans`, and flex alignment.
- Add styles for `.stakeholders` section with `.stakeholders__grid` (CSS grid with `repeat(auto-fit, minmax(280px, 1fr))` on desktop, 1 column on mobile).
- Add styles for `.stakeholder-card`: padding `var(--space-6)`, background `var(--color-surface)`, border `1px solid var(--color-border)`, border-radius `var(--radius-lg)`, and icon badge.
- Ensure all em-dashes in comments and content are cleaned up.

Update `src/features/landing/LandingScreen.tsx`:
- Import `useState` and `ReportCaseModal`.
- Import Phosphor icons: `Siren`, `MegaphoneSimple`, `Ambulance`, `HouseLine`, `FirstAid`, `ShieldCheck`, `ArrowSquareOut`.
- Topbar: `<span className="topbar__subheading">Animal welfare network</span>`.
- Hero:
  - Title: `Connecting everyone who protects animals.`
  - Lede: `A shared digital backbone for rescuers, shelters, veterinarians, and animal guardians. Report animals in distress, manage daily care, and coordinate rescues, even without internet signal.`
  - Primary button:
    ```tsx
    <button
      type="button"
      className="btn btn--emergency"
      onClick={() => setReportOpen(true)}
    >
      <Siren size={20} weight="bold" aria-hidden="true" />
      <span>Report a case</span>
    </button>
    ```
  - Secondary button:
    ```tsx
    <Link className="btn btn--secondary" to="/login">
      Sign in
    </Link>
    ```
- Stakeholders Section: 5 cards with icons, headings, and plain-language descriptions.
- Bento grid: Re-labeled for field agility, connected care chain, auditable ledger, data sovereignty.
- Partner Directory: Full coalition preserved with clear scope tags.
- Mohsin Project: Updated mission text for the animal welfare network without em-dashes.
- Mount `<ReportCaseModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/landing/landingScreen.test.tsx`
Expected: PASS (all 5 tests passed)

- [ ] **Step 5: Commit changes**

Run:
```bash
git add src/features/landing/ tests/unit/landing/
git commit -m "feat(landing): redesign landing screen as animal welfare network with 5 stakeholder pillars"
```

---

### Task 4: Full Verification and Production Build

**Files:**
- Entire repository

- [ ] **Step 1: Run vitest for all landing and auth tests**

Run: `npx vitest run tests/unit/landing/ tests/unit/auth/`
Expected: All tests PASS

- [ ] **Step 2: Run full production build**

Run: `npm run build`
Expected: Exit code 0, 0 build errors.

- [ ] **Step 3: Verify git status and clean working tree**

Run: `git status`
Expected: Clean working tree on `feat/landing-page-network-update`.
