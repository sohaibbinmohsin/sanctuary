# Public Rescue Report & Live Case Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dedicated `/report` emergency intake wizard and `/report/track/:reportNumber` live case tracking subsystem, mirroring Sanctuary's internal reports domain while providing crash resilience, repeat profile memory, anti-abuse security, and dedicated SEO.

**Architecture:** A 3-step public intake flow (`PublicReportScreen`) with step-level subcomponents that persist drafts to `localStorage` and reporter profiles for subsequent visits. Generates reports into Sanctuary's rescue reports database and redirects reporters to a read-only live case tracker (`PublicReportTrackScreen`) featuring the software's 5-stage status pipeline, masked personal data, and zero administrative buttons.

**Tech Stack:** React 19, TypeScript, React Router 7, `@phosphor-icons/react`, Vite, PowerSync/wa-sqlite, Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-10-23-rescue-report-intake-and-tracking-design.md`](file:///home/ubuntu/development/sanctuary-landing-page/docs/superpowers/specs/2026-10-23-rescue-report-intake-and-tracking-design.md)

## Global Constraints
- Strictly zero em-dashes (`—` or `--`) in all user-facing copy, error messages, and metadata.
- Design system tokens only: all colors, radii, shadows, and fonts must map directly to `src/styles/tokens.css`.
- Phosphor icons only: use `@phosphor-icons/react` (`Siren`, `CheckCircle`, `Crosshair`, `Camera`, `ShareNetwork`, `CaretRight`, `ArrowLeft`, `Copy`). No emojis.
- Mandatory full build verification: `npm run build` must succeed with 0 errors before completion.
- Never push to `main`; commit and push to `feat/landing-page-network-update`.

---

### Task 1: Draft & Profile Persistence Hooks + Domain Helpers

**Files:**
- Create: `src/features/reports/domain/privacyMask.ts`
- Create: `src/features/reports/hooks/useReportDraft.ts`
- Create: `src/features/reports/hooks/useReporterProfile.ts`
- Test: `tests/unit/reports/privacyMask.test.ts`
- Test: `tests/unit/reports/reportDraftHook.test.ts`
- Test: `tests/unit/reports/reporterProfileHook.test.ts`

**Interfaces:**
- Produces:
  - `maskPhoneNumber(phone?: string | null): string` -> e.g. `0300 ···· 567`
  - `maskCnic(cnic?: string | null): string` -> e.g. `42101-·······-1`
  - `useReportDraft()` -> `{ draft, updateDraft, clearDraft }`
  - `useReporterProfile()` -> `{ profile, saveProfile, clearProfile }`

- [ ] **Step 1: Write failing unit tests for privacy masking**

```typescript
// tests/unit/reports/privacyMask.test.ts
import { describe, it, expect } from 'vitest'
import { maskPhoneNumber, maskCnic } from '@/features/reports/domain/privacyMask'

describe('privacyMask', () => {
  it('masks pakistani mobile phone number showing only first 4 and last 3 digits', () => {
    expect(maskPhoneNumber('0300 1234567')).toBe('0300 ···· 567')
    expect(maskPhoneNumber('03211234567')).toBe('0321 ···· 567')
  })

  it('handles empty or short phone gracefully', () => {
    expect(maskPhoneNumber('')).toBe('')
    expect(maskPhoneNumber(null)).toBe('')
  })

  it('masks 13-digit CNIC showing prefix and suffix', () => {
    expect(maskCnic('42101-1234567-1')).toBe('42101-·······-1')
    expect(maskCnic('4210112345671')).toBe('42101-·······-1')
  })

  it('contains no em-dashes in masked output', () => {
    expect(maskPhoneNumber('0300 1234567')).not.toContain('—')
    expect(maskCnic('42101-1234567-1')).not.toContain('—')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/privacyMask.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement privacy masking helpers**

```typescript
// src/features/reports/domain/privacyMask.ts
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return phone
  const start = digits.slice(0, 4)
  const end = digits.slice(-3)
  return `${start} ···· ${end}`
}

export function maskCnic(cnic?: string | null): string {
  if (!cnic) return ''
  const digits = cnic.replace(/\D/g, '')
  if (digits.length !== 13) return cnic
  const prefix = digits.slice(0, 5)
  const suffix = digits.slice(-1)
  return `${prefix}-·······-${suffix}`
}
```

- [ ] **Step 4: Write failing tests for useReportDraft and useReporterProfile**

```typescript
// tests/unit/reports/reportDraftHook.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReportDraft, REPORT_DRAFT_KEY } from '@/features/reports/hooks/useReportDraft'

describe('useReportDraft', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with default empty draft', () => {
    const { result } = renderHook(() => useReportDraft())
    expect(result.current.draft.category).toBe('emergency')
    expect(result.current.draft.speciesPreset).toBe('Dog')
  })

  it('saves updates to localStorage', () => {
    const { result } = renderHook(() => useReportDraft())
    act(() => {
      result.current.updateDraft({ chiefComplaint: 'Fractured rear leg' })
    })
    expect(result.current.draft.chiefComplaint).toBe('Fractured rear leg')
    const stored = JSON.parse(localStorage.getItem(REPORT_DRAFT_KEY) || '{}')
    expect(stored.chiefComplaint).toBe('Fractured rear leg')
  })

  it('clears draft from localStorage', () => {
    const { result } = renderHook(() => useReportDraft())
    act(() => {
      result.current.updateDraft({ chiefComplaint: 'Test' })
      result.current.clearDraft()
    })
    expect(localStorage.getItem(REPORT_DRAFT_KEY)).toBeNull()
  })
})
```

```typescript
// tests/unit/reports/reporterProfileHook.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReporterProfile, REPORTER_PROFILE_KEY } from '@/features/reports/hooks/useReporterProfile'

describe('useReporterProfile', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores and restores reporter contact details', () => {
    const { result } = renderHook(() => useReporterProfile())
    expect(result.current.profile).toBeNull()

    act(() => {
      result.current.saveProfile({
        name: 'Usman Ali',
        phone: '0300 1234567',
        cnic: '42101-1234567-1',
        city: 'Lahore',
      })
    })

    expect(result.current.profile?.name).toBe('Usman Ali')
    const stored = JSON.parse(localStorage.getItem(REPORTER_PROFILE_KEY) || '{}')
    expect(stored.phone).toBe('0300 1234567')
  })
})
```

- [ ] **Step 5: Implement useReportDraft and useReporterProfile**

```typescript
// src/features/reports/hooks/useReportDraft.ts
import { useState, useCallback, useEffect } from 'react'

export const REPORT_DRAFT_KEY = 'sanctuary_report_draft_v1'

export type ReportDraftState = {
  currentStep: 1 | 2 | 3
  category: string
  intakeCountMode: 'single' | 'litter' | 'multiple'
  litterComposition: 'offspring_only' | 'mother_and_offspring'
  animalCount: number
  speciesPreset: string
  speciesOther: string
  avianSubtype: string
  lifeStage: 'adult' | 'child'
  chiefComplaint: string
  city: string
  locationArea: string
  locationLandmark: string
  latitude: number | null
  longitude: number | null
  reporterName: string
  reporterPhone: string
  reporterCnic: string
  rememberProfile: boolean
}

export const INITIAL_DRAFT: ReportDraftState = {
  currentStep: 1,
  category: 'emergency',
  intakeCountMode: 'single',
  litterComposition: 'offspring_only',
  animalCount: 1,
  speciesPreset: 'Dog',
  speciesOther: '',
  avianSubtype: '',
  lifeStage: 'adult',
  chiefComplaint: '',
  city: 'Lahore',
  locationArea: '',
  locationLandmark: '',
  latitude: null,
  longitude: null,
  reporterName: '',
  reporterPhone: '',
  reporterCnic: '',
  rememberProfile: true,
}

export function useReportDraft() {
  const [draft, setDraft] = useState<ReportDraftState>(() => {
    try {
      const saved = localStorage.getItem(REPORT_DRAFT_KEY)
      if (saved) return { ...INITIAL_DRAFT, ...JSON.parse(saved) }
    } catch {}
    return INITIAL_DRAFT
  })

  const updateDraft = useCallback((patch: Partial<ReportDraftState>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(REPORT_DRAFT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(INITIAL_DRAFT)
    try {
      localStorage.removeItem(REPORT_DRAFT_KEY)
    } catch {}
  }, [])

  return { draft, updateDraft, clearDraft }
}
```

```typescript
// src/features/reports/hooks/useReporterProfile.ts
import { useState, useCallback } from 'react'

export const REPORTER_PROFILE_KEY = 'sanctuary_reporter_profile_v1'

export type ReporterProfile = {
  name: string
  phone: string
  cnic: string
  city: string
}

export function useReporterProfile() {
  const [profile, setProfile] = useState<ReporterProfile | null>(() => {
    try {
      const saved = localStorage.getItem(REPORTER_PROFILE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return null
  })

  const saveProfile = useCallback((data: ReporterProfile) => {
    setProfile(data)
    try {
      localStorage.setItem(REPORTER_PROFILE_KEY, JSON.stringify(data))
    } catch {}
  }, [])

  const clearProfile = useCallback(() => {
    setProfile(null)
    try {
      localStorage.removeItem(REPORTER_PROFILE_KEY)
    } catch {}
  }, [])

  return { profile, saveProfile, clearProfile }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reports/privacyMask.test.ts tests/unit/reports/reportDraftHook.test.ts tests/unit/reports/reporterProfileHook.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 7: Commit**

```bash
git add src/features/reports/domain/privacyMask.ts src/features/reports/hooks/ tests/unit/reports/
git commit -m "feat(reports): add privacy masking, draft caching, and reporter profile hooks"
```

---

### Task 2: Public Report Form Step 1: Situation & Animal Details

**Files:**
- Create: `src/features/reports/components/public/PublicReportStepAnimal.tsx`
- Test: `tests/unit/reports/publicReportStepAnimal.test.tsx`

**Interfaces:**
- Consumes: `ReportDraftState` from `src/features/reports/hooks/useReportDraft.ts`, `AVIAN_PRESETS` from `src/features/reports/domain/rescueReports.ts`.
- Produces: `PublicReportStepAnimal` component with validation and 1-tap complaint presets.

- [ ] **Step 1: Write failing unit test for Step 1**

```typescript
// tests/unit/reports/publicReportStepAnimal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PublicReportStepAnimal } from '@/features/reports/components/public/PublicReportStepAnimal'
import { INITIAL_DRAFT } from '@/features/reports/hooks/useReportDraft'

describe('PublicReportStepAnimal', () => {
  it('renders category and species presets', () => {
    render(<PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('Medical emergency')).toBeInTheDocument()
    expect(screen.getByText('Animal cruelty')).toBeInTheDocument()
    expect(screen.getByText('Dog')).toBeInTheDocument()
    expect(screen.getByText('Cat')).toBeInTheDocument()
    expect(screen.getByText('Horse')).toBeInTheDocument()
    expect(screen.getByText('Donkey')).toBeInTheDocument()
    expect(screen.getByText('Bird')).toBeInTheDocument()
  })

  it('renders quick complaint buttons that append to complaint input', () => {
    const onUpdate = vi.fn()
    render(<PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={onUpdate} onNext={vi.fn()} />)
    const quickTag = screen.getByText('Hit by vehicle')
    fireEvent.click(quickTag)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ chiefComplaint: 'Hit by vehicle' }))
  })

  it('shows avian sub-types when Bird is selected', () => {
    const draft = { ...INITIAL_DRAFT, speciesPreset: 'Bird' }
    render(<PublicReportStepAnimal draft={draft} onUpdate={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('Black Kite')).toBeInTheDocument()
    expect(screen.getByText('Eagle')).toBeInTheDocument()
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={vi.fn()} onNext={vi.fn()} />
    )
    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('--')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/publicReportStepAnimal.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PublicReportStepAnimal**

```tsx
// src/features/reports/components/public/PublicReportStepAnimal.tsx
import { type FormEvent } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { AVIAN_PRESETS } from '@/features/reports/domain/rescueReports'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'

export const SPECIES_OPTIONS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other'] as const

export const QUICK_COMPLAINTS = [
  'Hit by vehicle',
  'Severe bleeding',
  'Fractured limb',
  'Unable to stand',
  'Sick or malnourished',
  'Trapped or abused',
] as const

export type PublicReportStepAnimalProps = {
  draft: ReportDraftState
  onUpdate: (patch: Partial<ReportDraftState>) => void
  onNext: () => void
}

export function PublicReportStepAnimal({ draft, onUpdate, onNext }: PublicReportStepAnimalProps) {
  function handleQuickComplaint(tag: string) {
    if (!draft.chiefComplaint.trim()) {
      onUpdate({ chiefComplaint: tag })
    } else if (!draft.chiefComplaint.includes(tag)) {
      onUpdate({ chiefComplaint: `${draft.chiefComplaint.trim()}, ${tag}` })
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.chiefComplaint.trim()) return
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="public-report__step-form">
      <div className="public-report__group">
        <label className="public-report__label">What kind of report is this?</label>
        <div className="public-report__chips" role="group" aria-label="Report category">
          <button
            type="button"
            className={`public-report__chip${draft.category === 'emergency' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.category === 'emergency'}
            onClick={() => onUpdate({ category: 'emergency' })}
          >
            Medical emergency
          </button>
          <button
            type="button"
            className={`public-report__chip${draft.category === 'cruelty' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.category === 'cruelty'}
            onClick={() => onUpdate({ category: 'cruelty' })}
          >
            Animal cruelty
          </button>
        </div>
      </div>

      <div className="public-report__group">
        <label className="public-report__label">Animal count and composition</label>
        <div className="public-report__chips" role="group" aria-label="Animal composition">
          <button
            type="button"
            className={`public-report__chip${draft.intakeCountMode === 'single' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.intakeCountMode === 'single'}
            onClick={() => onUpdate({ intakeCountMode: 'single', animalCount: 1 })}
          >
            Single Animal
          </button>
          <button
            type="button"
            className={`public-report__chip${draft.intakeCountMode === 'litter' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.intakeCountMode === 'litter'}
            onClick={() => onUpdate({ intakeCountMode: 'litter', animalCount: Math.max(2, draft.animalCount) })}
          >
            Litter or Family
          </button>
          <button
            type="button"
            className={`public-report__chip${draft.intakeCountMode === 'multiple' ? ' public-report__chip--active' : ''}`}
            aria-pressed={draft.intakeCountMode === 'multiple'}
            onClick={() => onUpdate({ intakeCountMode: 'multiple', animalCount: Math.max(2, draft.animalCount) })}
          >
            Multiple Animals
          </button>
        </div>
      </div>

      {draft.intakeCountMode !== 'single' ? (
        <div className="public-report__group">
          <label className="public-report__label" htmlFor="animal-count">
            Total count
          </label>
          <div className="public-report__stepper">
            <button
              type="button"
              className="public-report__step-btn"
              onClick={() => onUpdate({ animalCount: Math.max(2, draft.animalCount - 1) })}
              disabled={draft.animalCount <= 2}
              aria-label="Decrease count"
            >
              -
            </button>
            <span className="public-report__step-count">{draft.animalCount}</span>
            <button
              type="button"
              className="public-report__step-btn"
              onClick={() => onUpdate({ animalCount: draft.animalCount + 1 })}
              aria-label="Increase count"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <div className="public-report__group">
        <label className="public-report__label">Animal type</label>
        <div className="public-report__chips" role="group" aria-label="Animal type">
          {SPECIES_OPTIONS.map((item) => (
            <button
              type="button"
              key={item}
              className={`public-report__chip${draft.speciesPreset === item ? ' public-report__chip--active' : ''}`}
              aria-pressed={draft.speciesPreset === item}
              onClick={() => onUpdate({ speciesPreset: item, avianSubtype: '' })}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {draft.speciesPreset === 'Bird' ? (
        <div className="public-report__group">
          <label className="public-report__label">Avian species</label>
          <div className="public-report__chips" role="group" aria-label="Avian species">
            {AVIAN_PRESETS.map((item) => (
              <button
                type="button"
                key={item}
                className={`public-report__chip${draft.avianSubtype === item ? ' public-report__chip--active' : ''}`}
                aria-pressed={draft.avianSubtype === item}
                onClick={() => onUpdate({ avianSubtype: item })}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {draft.speciesPreset === 'Other' ? (
        <div className="public-report__field">
          <label htmlFor="species-other" className="public-report__label">
            Specify animal
          </label>
          <input
            id="species-other"
            type="text"
            className="public-report__input"
            placeholder="e.g. Goat, Falcon, Rabbit"
            value={draft.speciesOther}
            onChange={(e) => onUpdate({ speciesOther: e.target.value })}
            required
          />
        </div>
      ) : null}

      <div className="public-report__field">
        <label htmlFor="chief-complaint" className="public-report__label">
          What happened / Injury description
        </label>
        <div className="public-report__quick-tags" aria-label="Quick complaint tags">
          {QUICK_COMPLAINTS.map((tag) => (
            <button
              key={tag}
              type="button"
              className="public-report__quick-tag"
              onClick={() => handleQuickComplaint(tag)}
            >
              + {tag}
            </button>
          ))}
        </div>
        <textarea
          id="chief-complaint"
          className="public-report__textarea"
          rows={3}
          placeholder="Describe the injury, bleeding, behavior, or emergency situation"
          value={draft.chiefComplaint}
          onChange={(e) => onUpdate({ chiefComplaint: e.target.value })}
          required
        />
      </div>

      <div className="public-report__actions">
        <button
          type="submit"
          className="public-report__btn public-report__btn--primary"
          disabled={!draft.chiefComplaint.trim()}
        >
          Continue to Location
          <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reports/publicReportStepAnimal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/components/public/PublicReportStepAnimal.tsx tests/unit/reports/publicReportStepAnimal.test.tsx
git commit -m "feat(reports): create PublicReportStepAnimal intake component"
```

---

### Task 3: Public Report Form Step 2: Location & Media Upload

**Files:**
- Create: `src/features/reports/components/public/PublicReportStepLocation.tsx`
- Test: `tests/unit/reports/publicReportStepLocation.test.tsx`

**Interfaces:**
- Consumes: `ReportDraftState` from `src/features/reports/hooks/useReportDraft.ts`, `PAKISTAN_CITIES` from `src/features/reports/domain/pakistanLocations.ts`, `requestCurrentPosition` from `src/features/reports/domain/coordinates.ts`.
- Produces: `PublicReportStepLocation` component with 1-tap GPS and image upload.

- [ ] **Step 1: Write failing unit test for Step 2**

```typescript
// tests/unit/reports/publicReportStepLocation.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PublicReportStepLocation } from '@/features/reports/components/public/PublicReportStepLocation'
import { INITIAL_DRAFT } from '@/features/reports/hooks/useReportDraft'

describe('PublicReportStepLocation', () => {
  it('renders city selector and area input', () => {
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Area/i)).toBeInTheDocument()
    expect(screen.getByText(/Share exact GPS location/i)).toBeInTheDocument()
  })

  it('validates area before continuing', () => {
    const onNext = vi.fn()
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={onNext}
      />
    )
    const nextBtn = screen.getByRole('button', { name: /Continue to Contact/i })
    expect(nextBtn).toBeDisabled()
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <PublicReportStepLocation
        draft={{ ...INITIAL_DRAFT, locationArea: 'Gulberg' }}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('--')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/publicReportStepLocation.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PublicReportStepLocation**

```tsx
// src/features/reports/components/public/PublicReportStepLocation.tsx
import { useState, type FormEvent, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, Crosshair, Check, Camera, Trash } from '@phosphor-icons/react'
import { PAKISTAN_CITIES, getAreasForCity } from '@/features/reports/domain/pakistanLocations'
import { requestCurrentPosition } from '@/features/reports/domain/coordinates'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'

export type PublicPhotoItem = {
  id: string
  url: string
  blob: Blob
}

export type PublicReportStepLocationProps = {
  draft: ReportDraftState
  photos: PublicPhotoItem[]
  onUpdate: (patch: Partial<ReportDraftState>) => void
  onAddPhotos: (newPhotos: PublicPhotoItem[]) => void
  onRemovePhoto: (id: string) => void
  onBack: () => void
  onNext: () => void
}

export function PublicReportStepLocation({
  draft,
  photos,
  onUpdate,
  onAddPhotos,
  onRemovePhoto,
  onBack,
  onNext,
}: PublicReportStepLocationProps) {
  const [detectingGps, setDetectingGps] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const cityAreas = getAreasForCity(draft.city)

  async function handleGetLocation() {
    setDetectingGps(true)
    setGpsError(null)
    try {
      const pos = await requestCurrentPosition()
      onUpdate({ latitude: pos.latitude, longitude: pos.longitude })
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Could not detect GPS location.')
    } finally {
      setDetectingGps(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const items: PublicPhotoItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      items.push({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        blob: file,
      })
    }
    onAddPhotos(items)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.locationArea.trim()) return
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="public-report__step-form">
      <div className="public-report__field">
        <label htmlFor="report-city" className="public-report__label">
          City
        </label>
        <select
          id="report-city"
          className="public-report__select"
          value={draft.city}
          onChange={(e) => onUpdate({ city: e.target.value })}
        >
          {PAKISTAN_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="public-report__field">
        <label htmlFor="report-area" className="public-report__label">
          Area or Neighborhood
        </label>
        <input
          id="report-area"
          type="text"
          list="area-suggestions"
          className="public-report__input"
          placeholder="e.g. Gulberg III, DHA Phase 5, Saddar"
          value={draft.locationArea}
          onChange={(e) => onUpdate({ locationArea: e.target.value })}
          required
        />
        <datalist id="area-suggestions">
          {cityAreas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      <div className="public-report__field">
        <label htmlFor="report-landmark" className="public-report__label">
          Specific landmark or street (optional)
        </label>
        <input
          id="report-landmark"
          type="text"
          className="public-report__input"
          placeholder="e.g. Near Kalma Chowk underpass, opposite bakery"
          value={draft.locationLandmark}
          onChange={(e) => onUpdate({ locationLandmark: e.target.value })}
        />
      </div>

      <div className="public-report__gps-box">
        <div className="public-report__gps-info">
          <span className="public-report__label">Precise GPS coordinates</span>
          <p className="public-report__hint">
            Helps field rescue teams navigate directly to the animal in rural or unmapped areas.
          </p>
          {draft.latitude && draft.longitude ? (
            <span className="public-report__gps-badge">
              <Check size={14} weight="bold" aria-hidden /> GPS captured ({draft.latitude.toFixed(4)}, {draft.longitude.toFixed(4)})
            </span>
          ) : null}
          {gpsError ? <span className="public-report__error">{gpsError}</span> : null}
        </div>
        <button
          type="button"
          className="public-report__btn public-report__btn--secondary"
          onClick={handleGetLocation}
          disabled={detectingGps}
        >
          <Crosshair size={18} weight="bold" aria-hidden />
          {detectingGps ? 'Detecting…' : 'Share exact GPS location'}
        </button>
      </div>

      <div className="public-report__field">
        <label className="public-report__label">Photos of the animal or scene (optional)</label>
        <div className="public-report__photo-grid">
          {photos.map((item) => (
            <div key={item.id} className="public-report__photo-thumb">
              <img src={item.url} alt="Staged rescue photo" />
              <button
                type="button"
                className="public-report__photo-remove"
                onClick={() => onRemovePhoto(item.id)}
                aria-label="Remove photo"
              >
                <Trash size={16} weight="bold" />
              </button>
            </div>
          ))}
          {photos.length < 5 ? (
            <label className="public-report__photo-upload">
              <Camera size={26} weight="duotone" aria-hidden />
              <span>Add photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="public-report__file-hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="public-report__actions public-report__actions--split">
        <button type="button" className="public-report__btn public-report__btn--secondary" onClick={onBack}>
          <ArrowLeft size={18} weight="bold" aria-hidden />
          Back
        </button>
        <button
          type="submit"
          className="public-report__btn public-report__btn--primary"
          disabled={!draft.locationArea.trim()}
        >
          Continue to Contact
          <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reports/publicReportStepLocation.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/components/public/PublicReportStepLocation.tsx tests/unit/reports/publicReportStepLocation.test.tsx
git commit -m "feat(reports): create PublicReportStepLocation intake component"
```

---

### Task 4: Public Report Form Step 3: Contact, Profile Save & Review

**Files:**
- Create: `src/features/reports/components/public/PublicReportStepContact.tsx`
- Test: `tests/unit/reports/publicReportStepContact.test.tsx`

**Interfaces:**
- Consumes: `validatePhoneNumber`, `formatPhoneNumber`, `validateCnic`, `formatCnic` from reports domain.
- Produces: `PublicReportStepContact` with honeypot security shield and summary review.

- [ ] **Step 1: Write failing unit test for Step 3**

```typescript
// tests/unit/reports/publicReportStepContact.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PublicReportStepContact } from '@/features/reports/components/public/PublicReportStepContact'
import { INITIAL_DRAFT } from '@/features/reports/hooks/useReportDraft'

describe('PublicReportStepContact', () => {
  it('renders phone input and optional CNIC', () => {
    render(
      <PublicReportStepContact
        draft={INITIAL_DRAFT}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/Mobile phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/CNIC/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit Emergency Report/i })).toBeInTheDocument()
  })

  it('validates phone number format', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepContact
        draft={INITIAL_DRAFT}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={onUpdate}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const phoneInput = screen.getByLabelText(/Mobile phone/i)
    fireEvent.change(phoneInput, { target: { value: '0300 1234567' } })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ reporterPhone: '0300 1234567' }))
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567', chiefComplaint: 'Injured dog', locationArea: 'Gulberg' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('--')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/publicReportStepContact.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PublicReportStepContact**

```tsx
// src/features/reports/components/public/PublicReportStepContact.tsx
import { type FormEvent, useState } from 'react'
import { ArrowLeft, Check, Siren } from '@phosphor-icons/react'
import { validatePhoneNumber, formatPhoneNumber } from '@/features/reports/domain/phone'
import { validateCnic, formatCnic } from '@/features/reports/domain/cnic'
import type { ReportDraftState } from '@/features/reports/hooks/useReportDraft'
import type { PublicPhotoItem } from './PublicReportStepLocation'

export type PublicReportStepContactProps = {
  draft: ReportDraftState
  photos: PublicPhotoItem[]
  submitting: boolean
  error: string | null
  onUpdate: (patch: Partial<ReportDraftState>) => void
  onBack: () => void
  onSubmit: (e: FormEvent, honeypotValue: string) => void
}

export function PublicReportStepContact({
  draft,
  photos,
  submitting,
  error,
  onUpdate,
  onBack,
  onSubmit,
}: PublicReportStepContactProps) {
  const [honeypot, setHoneypot] = useState('')
  const phoneValidation = validatePhoneNumber(draft.reporterPhone)
  const cnicValidation = validateCnic(draft.reporterCnic)

  const isPhoneValid = draft.reporterPhone.trim().length > 0 && phoneValidation.isValid
  const isCnicValid = !draft.reporterCnic.trim() || cnicValidation.isValid

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isPhoneValid || !isCnicValid) return
    onSubmit(e, honeypot)
  }

  return (
    <form onSubmit={handleFormSubmit} className="public-report__step-form">
      {/* Honeypot trap for automated bots */}
      <input
        type="text"
        name="sanctuary_security_trap"
        tabIndex={-1}
        autoComplete="off"
        style={{ display: 'none', position: 'absolute', left: '-9999px' }}
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        aria-hidden="true"
      />

      <div className="public-report__field">
        <label htmlFor="reporter-phone" className="public-report__label">
          Mobile phone number
        </label>
        <input
          id="reporter-phone"
          type="tel"
          className="public-report__input"
          placeholder="0300 1234567"
          value={draft.reporterPhone}
          onChange={(e) => onUpdate({ reporterPhone: formatPhoneNumber(e.target.value) })}
          required
        />
        {draft.reporterPhone.trim() ? (
          phoneValidation.isValid ? (
            <span className="public-report__valid-hint">
              <Check size={14} weight="bold" /> Valid mobile number
            </span>
          ) : (
            <span className="public-report__error">{phoneValidation.error}</span>
          )
        ) : null}
      </div>

      <div className="public-report__field">
        <label htmlFor="reporter-name" className="public-report__label">
          Your name (optional)
        </label>
        <input
          id="reporter-name"
          type="text"
          className="public-report__input"
          placeholder="e.g. Usman Ali"
          value={draft.reporterName}
          onChange={(e) => onUpdate({ reporterName: e.target.value })}
        />
      </div>

      <div className="public-report__field">
        <label htmlFor="reporter-cnic" className="public-report__label">
          CNIC (optional)
        </label>
        <input
          id="reporter-cnic"
          type="text"
          className="public-report__input"
          placeholder="42101-1234567-1"
          value={draft.reporterCnic}
          onChange={(e) => onUpdate({ reporterCnic: formatCnic(e.target.value) })}
        />
        {draft.reporterCnic.trim() ? (
          cnicValidation.isValid ? (
            <span className="public-report__valid-hint">
              <Check size={14} weight="bold" /> Valid CNIC
            </span>
          ) : (
            <span className="public-report__error">{cnicValidation.error}</span>
          )
        ) : null}
      </div>

      <label className="public-report__checkbox-label">
        <input
          type="checkbox"
          checked={draft.rememberProfile}
          onChange={(e) => onUpdate({ rememberProfile: e.target.checked })}
        />
        <span>Remember my contact details on this device for future rescue reports</span>
      </label>

      {/* Summary card */}
      <div className="public-report__summary">
        <h4 className="public-report__summary-title">Report Summary</h4>
        <div className="public-report__summary-row">
          <span>Animal</span>
          <strong>
            {draft.speciesPreset === 'Other' ? draft.speciesOther : draft.speciesPreset}
            {draft.avianSubtype ? ` (${draft.avianSubtype})` : ''} · {draft.animalCount} in care
          </strong>
        </div>
        <div className="public-report__summary-row">
          <span>Complaint</span>
          <strong>{draft.chiefComplaint}</strong>
        </div>
        <div className="public-report__summary-row">
          <span>Location</span>
          <strong>
            {draft.locationArea}, {draft.city}
            {draft.locationLandmark ? ` (${draft.locationLandmark})` : ''}
          </strong>
        </div>
        <div className="public-report__summary-row">
          <span>Photos</span>
          <strong>{photos.length} attached</strong>
        </div>
      </div>

      {error ? <p className="public-report__error-banner">{error}</p> : null}

      <div className="public-report__actions public-report__actions--split">
        <button
          type="button"
          className="public-report__btn public-report__btn--secondary"
          onClick={onBack}
          disabled={submitting}
        >
          <ArrowLeft size={18} weight="bold" aria-hidden />
          Back
        </button>
        <button
          type="submit"
          className="public-report__btn public-report__btn--primary"
          disabled={submitting || !isPhoneValid || !isCnicValid}
        >
          <Siren size={20} weight="bold" aria-hidden />
          {submitting ? 'Submitting report…' : 'Submit Emergency Report'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reports/publicReportStepContact.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/components/public/PublicReportStepContact.tsx tests/unit/reports/publicReportStepContact.test.tsx
git commit -m "feat(reports): create PublicReportStepContact component with honeypot shield"
```

---

### Task 5: Full Public Report Screen (`PublicReportScreen`) & Route `/report`

**Files:**
- Create: `src/features/reports/screens/PublicReportScreen.tsx`
- Create: `src/features/reports/publicReport.css`
- Modify: `src/shared/lib/public/slug.ts:2-20`
- Modify: `src/app/App.tsx:16-105`
- Modify: `src/features/landing/LandingScreen.tsx` (update "Report a case" button to navigate to `/report`)
- Test: `tests/unit/reports/publicReportScreen.test.tsx`

**Interfaces:**
- Produces: `PublicReportScreen` mounted at `/report`, registers `'report'` in reserved slugs.

- [ ] **Step 1: Write failing test for PublicReportScreen**

```typescript
// tests/unit/reports/publicReportScreen.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { PublicReportScreen } from '@/features/reports/screens/PublicReportScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    execute: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
  }),
}))

describe('PublicReportScreen', () => {
  it('renders 3-step navigation header and Step 1 by default', () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <PublicReportScreen />
      </MemoryRouter>
    )
    expect(screen.getByText('Animal')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('Medical emergency')).toBeInTheDocument()
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/report']}>
        <PublicReportScreen />
      </MemoryRouter>
    )
    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('--')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/publicReportScreen.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PublicReportScreen & styling**

Create `src/features/reports/publicReport.css` with responsive container, progress bar, token-driven colors, and form styles.
Create `src/features/reports/screens/PublicReportScreen.tsx` orchestrating Step 1, Step 2, and Step 3 with `useReportDraft`, `useReporterProfile`, database persistence via `createRescueReport` (or public simulation if unauthenticated), and navigation to `/report/track/:reportNumber`.
Update `src/shared/lib/public/slug.ts` to include `'report'` in `RESERVED_PUBLIC_SLUGS`.
Update `src/app/App.tsx` routes.
Update `src/features/landing/LandingScreen.tsx` to navigate to `/report` on "Report a case" click.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reports/publicReportScreen.test.tsx tests/unit/landing/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/screens/PublicReportScreen.tsx src/features/reports/publicReport.css src/shared/lib/public/slug.ts src/app/App.tsx src/features/landing/LandingScreen.tsx tests/unit/reports/publicReportScreen.test.tsx
git commit -m "feat(reports): implement PublicReportScreen at route /report"
```

---

### Task 6: Public Live Case Tracker (`PublicReportTrackScreen`) & Route `/report/track/:reportNumber`

**Files:**
- Create: `src/features/reports/screens/PublicReportTrackScreen.tsx`
- Test: `tests/unit/reports/publicReportTrackScreen.test.tsx`

**Interfaces:**
- Consumes: `getRescueReportByNumber` or `getRescueReportById` from reports domain, `maskPhoneNumber`, `maskCnic` from privacy domain.
- Produces: `PublicReportTrackScreen` mounted at `/report/track/:reportNumber`.

- [ ] **Step 1: Write failing test for PublicReportTrackScreen**

```typescript
// tests/unit/reports/publicReportTrackScreen.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { PublicReportTrackScreen } from '@/features/reports/screens/PublicReportTrackScreen'

const mockReport = {
  id: 'rep-1',
  report_number: 'SANCTUARY-0142',
  status: 'logged',
  species: 'dog',
  animal_count: 1,
  chief_complaint: 'Hit by rickshaw, fractured leg',
  city: 'Lahore',
  location_area: 'Gulberg',
  location_landmark: 'Near Main Market',
  reporter_phone: '03001234567',
  reporter_cnic: '4210112345671',
  stage_logged_at: '2026-10-23T12:00:00Z',
  created_at: '2026-10-23T12:00:00Z',
}

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    get: vi.fn().mockResolvedValue(mockReport),
    getAll: vi.fn().mockResolvedValue([]),
  }),
}))

describe('PublicReportTrackScreen', () => {
  it('renders case number and pipeline status', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText(/SANCTUARY-0142/i)).toBeInTheDocument()
    expect(screen.getByText(/Logged/i)).toBeInTheDocument()
    expect(screen.getByText(/Dispatched/i)).toBeInTheDocument()
  })

  it('masks reporter personal contact data', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('0300 ···· 567')).toBeInTheDocument()
    expect(screen.getByText('42101-·······-1')).toBeInTheDocument()
    expect(screen.queryByText('03001234567')).toBeNull()
  })

  it('contains strictly zero administrative edit buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByText(/SANCTUARY-0142/i)
    expect(screen.queryByRole('button', { name: /Edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Dismiss/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull()
  })

  it('contains strictly zero em-dashes', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/report/track/SANCTUARY-0142']}>
        <Routes>
          <Route path="/report/track/:reportNumber" element={<PublicReportTrackScreen />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByText(/SANCTUARY-0142/i)
    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('--')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/publicReportTrackScreen.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PublicReportTrackScreen**

Build `PublicReportTrackScreen` with:
- Top bar with back to `/report` and copy tracking link button.
- Case header card with report number, current status badge, and friendly status explanation banner.
- Visual Pipeline tracker (5 steps: Logged -> Accepted -> Dispatched -> Attended -> Resolved).
- Case details facts (Species, count, complaint, location, photo gallery).
- Masked reporter contact block.
- Zero administrative buttons.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reports/publicReportTrackScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/screens/PublicReportTrackScreen.tsx tests/unit/reports/publicReportTrackScreen.test.tsx
git commit -m "feat(reports): implement PublicReportTrackScreen at /report/track/:reportNumber"
```

---

### Task 7: SEO Metadata, Dedicated Social Card (`og-report.jpg`), & Zero Em-Dashes Verification

**Files:**
- Create: `scripts/generate-og-report.mjs`
- Create: `public/og-report.jpg`
- Create: `src/features/reports/domain/reportSeo.ts`
- Test: `tests/unit/reports/publicReportSeoAndEmDashes.test.ts`

**Interfaces:**
- Produces: `public/og-report.jpg`, automated zero em-dashes verification.

- [ ] **Step 1: Create scripts/generate-og-report.mjs & generate public/og-report.jpg**

```javascript
// scripts/generate-og-report.mjs
// Generates 1200x630 public/og-report.jpg with emergency siren icon and "Report an animal in distress" branding
```
Run: `node scripts/generate-og-report.mjs`
Verify `public/og-report.jpg` is generated.

- [ ] **Step 2: Create reportSeo.ts helper and update index.html / document head**

Implement dynamic title and meta management for `/report` and `/report/track/:reportNumber`.

- [ ] **Step 3: Write automated test for SEO and zero em-dashes**

```typescript
// tests/unit/reports/publicReportSeoAndEmDashes.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Public report zero em-dashes verification', () => {
  const filesToCheck = [
    'src/features/reports/components/public/PublicReportStepAnimal.tsx',
    'src/features/reports/components/public/PublicReportStepLocation.tsx',
    'src/features/reports/components/public/PublicReportStepContact.tsx',
    'src/features/reports/screens/PublicReportScreen.tsx',
    'src/features/reports/screens/PublicReportTrackScreen.tsx',
    'src/features/reports/publicReport.css',
  ]

  for (const file of filesToCheck) {
    it(`verifies no em-dashes in ${file}`, () => {
      const content = fs.readFileSync(path.resolve(file), 'utf8')
      expect(content).not.toContain('—')
      expect(content).not.toContain('--')
    })
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reports/publicReportSeoAndEmDashes.test.ts`
Expected: PASS

- [ ] **Step 5: Run full production build verification**

Run: `npm run build`
Expected: 0 errors, build succeeds cleanly.

- [ ] **Step 6: Commit and Push**

```bash
git add scripts/generate-og-report.mjs public/og-report.jpg src/features/reports/ tests/unit/reports/
git commit -m "feat(seo): add dedicated og-report.jpg, report SEO, and zero em-dashes verification"
git push origin feat/landing-page-network-update
```
