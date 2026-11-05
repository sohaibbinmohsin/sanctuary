# 5-Step Pipeline, Walk-in Intake, and Animal Outcome Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the rescue report pipeline to 5 steps (field rescue) and 3 steps (walk-in intake), link report completion to whether all associated animals have reached an exit outcome (Transferred, Released, Adopted, Deceased), provide clinic & partner suggestions for transfers, and add backdatable date/time fields with a "Log walk-in" button.

**Architecture:** 
1. The report pipeline adapts dynamically: 5 steps for standard field dispatch, 3 steps for direct walk-ins.
2. An outcome helper checks the current status of all animals linked to a report (primary and companions). A report is marked "Completed" only when all linked animals have left care via one of the 4 outcomes: Transferred, Released, Adopted, or Deceased (or on-site spot-release / DOA).
3. Transfer suggestions in `AnimalDetailScreen` combine vet clinics and partner shelters under the "Partner Organization" label.
4. `ReportIntakeScreen` supports a `?type=walk-in` mode and an explicit date/time picker for backdating.
5. `ReportsListScreen` features both "Log walk-in" and "Log report" buttons and accurately filters completed vs in-progress cases based on linked animal outcomes.

**Tech Stack:** React 19, TypeScript, PowerSync SQLite (`SanctuaryDb`), Vitest, Testing Library.

**Spec / Requirements:**
- Section 1: Transfer field label stays "Partner Organization", suggestions include vet clinics + shelters; Open profile button unchanged; report marked complete only when all linked animals have one of the 4 outcomes.
- Section 2: "Log walk-in" button next to "Log report"; Date & time on both forms for backdating; Field rescue = 5 steps, walk-in = 3 steps; Form field order preserved.

---

### Task 1: Partner Organization Transfer Suggestions & Clinic Directory Integration

**Files:**
- Modify: `src/features/reports/domain/partnerDirectory.ts`
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx:1738-1760`
- Test: `tests/features/animals/partnerTransferSuggestions.test.ts`

**Interfaces:**
- Consumes: `PRESET_VET_CLINICS`, `PRESET_PARTNER_ORGS` from `partnerDirectory.ts`
- Produces: `getCombinedPartnerSuggestions(db, orgId, query): Promise<{ name: string; slug: string }[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/features/animals/partnerTransferSuggestions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getCombinedPartnerSuggestions } from '@/features/reports/domain/partnerDirectory'

describe('getCombinedPartnerSuggestions', () => {
  it('returns both clinics and partner shelters matching query', async () => {
    const suggestions = await getCombinedPartnerSuggestions(null, 'org-1', '')
    const names = suggestions.map((s) => s.name)
    expect(names).toContain('UVAS Small Animal Hospital')
    expect(names).toContain("Todd's Welfare Society (TWS)")
  })

  it('filters suggestions case-insensitively', async () => {
    const suggestions = await getCombinedPartnerSuggestions(null, 'org-1', 'uvas')
    expect(suggestions.length).toBeGreaterThanOrEqual(1)
    expect(suggestions[0].name).toContain('UVAS')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/features/animals/partnerTransferSuggestions.test.ts`
Expected: FAIL (`getCombinedPartnerSuggestions` is not exported)

- [ ] **Step 3: Implement `getCombinedPartnerSuggestions` and update `AnimalDetailScreen`**

In `src/features/reports/domain/partnerDirectory.ts`:
```typescript
export async function getCombinedPartnerSuggestions(
  db: SanctuaryDb | null,
  orgId: string,
  query: string,
): Promise<{ name: string; slug: string }[]> {
  const [clinics, partners] = await Promise.all([
    getClinicSuggestions(db, orgId, query),
    getPartnerSuggestions(db, orgId, query),
  ])
  const map = new Map<string, { name: string; slug: string }>()
  for (const item of [...clinics, ...partners]) {
    if (!map.has(item.slug)) {
      map.set(item.slug, item)
    }
  }
  return Array.from(map.values())
}
```

In `src/features/animals/screens/AnimalDetailScreen.tsx`:
Ensure `AutocompleteField` for `isTransferred` uses `getCombinedPartnerSuggestions` (or combined preset list `[...PRESET_VET_CLINICS, ...PRESET_PARTNER_ORGS]`) with the label "Partner Organization".

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/features/animals/partnerTransferSuggestions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/domain/partnerDirectory.ts src/features/animals/screens/AnimalDetailScreen.tsx tests/features/animals/partnerTransferSuggestions.test.ts
git commit -m "feat(animals): include clinics in partner organization transfer suggestions"
```

---

### Task 2: Multi-Animal Report Outcome & Completion Domain Logic

**Files:**
- Create/Modify: `src/features/reports/domain/reportOutcomes.ts`
- Modify: `src/features/reports/domain/rescueReports.ts`
- Test: `tests/features/reports/reportOutcomes.test.ts`

**Interfaces:**
- Consumes: `SanctuaryDb`, `RescueReport`
- Produces: `getReportCompletionStatus(db: SanctuaryDb, report: RescueReport): Promise<{ isCompleted: boolean; outcomeLabel: string; activeCount: number; completedCount: number }>`

- [ ] **Step 1: Write the failing test**

Create `tests/features/reports/reportOutcomes.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { getReportCompletionStatus } from '@/features/reports/domain/reportOutcomes'
import type { RescueReport } from '@/features/reports/domain/rescueReports'

describe('getReportCompletionStatus', () => {
  it('returns completed for spot_released reports without animal', async () => {
    const report: Partial<RescueReport> = {
      id: 'r1',
      status: 'attended',
      disposition_type: 'spot_released',
      animal_id: null,
    }
    const result = await getReportCompletionStatus({} as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Spot Released')
  })

  it('returns in-progress if primary linked animal is still in care', async () => {
    const mockDb = {
      getAll: vi.fn().mockResolvedValue([]), // no companions
      getOptional: vi.fn().mockResolvedValue({
        id: 'a1',
        counts_as_in_care: 1,
        status_label: 'Under Treatment',
      }),
    }
    const report: Partial<RescueReport> = {
      id: 'r2',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(false)
    expect(result.outcomeLabel).toBe('Under Treatment')
  })

  it('returns completed when all linked animals (primary + companions) have exit status', async () => {
    const mockDb = {
      // Primary animal
      getOptional: vi.fn().mockResolvedValue({
        id: 'a1',
        counts_as_in_care: 0,
        status_label: 'Transferred',
      }),
      // Companions
      getAll: vi.fn().mockResolvedValue([
        { id: 'a2', counts_as_in_care: 0, status_label: 'Transferred' },
      ]),
    }
    const report: Partial<RescueReport> = {
      id: 'r3',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Transferred')
  })

  it('returns in-progress if one of multiple animals is still in care', async () => {
    const mockDb = {
      getOptional: vi.fn().mockResolvedValue({
        id: 'a1',
        counts_as_in_care: 0,
        status_label: 'Adopted',
      }),
      getAll: vi.fn().mockResolvedValue([
        { id: 'a2', counts_as_in_care: 1, status_label: 'Under Treatment' },
      ]),
    }
    const report: Partial<RescueReport> = {
      id: 'r4',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/features/reports/reportOutcomes.test.ts`
Expected: FAIL (`reportOutcomes.ts` does not exist)

- [ ] **Step 3: Implement `reportOutcomes.ts`**

Create `src/features/reports/domain/reportOutcomes.ts`:
Query primary animal and companion animals (linked via `animal_relationships` where `notes LIKE '%Auto-linked from rescue report <report_number>%'` or related to `animal_id`).
Check their effective status `counts_as_in_care`.
Exit outcomes are `counts_as_in_care === 0` (Transferred, Released, Adopted, Deceased).
If all linked animals are exit outcomes, `isCompleted = true`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/features/reports/reportOutcomes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/domain/reportOutcomes.ts tests/features/reports/reportOutcomes.test.ts
git commit -m "feat(reports): add linked animal outcome and completion evaluation"
```

---

### Task 3: 5-Step (Field Rescue) and 3-Step (Walk-in) Pipeline Tracker

**Files:**
- Modify: `src/features/reports/components/ReportPipelineTracker.tsx`
- Modify: `src/features/reports/screens/ReportDetailScreen.tsx`
- Test: `tests/features/reports/pipelineTrackerSteps.test.tsx`

**Interfaces:**
- Consumes: `ReportPipelineTrackerProps`, `getReportCompletionStatus`
- Produces: 5-step rendering for field rescue reports, 3-step rendering for walk-in reports (`intake_source === 'walk_in'`).

- [ ] **Step 1: Write the failing test**

Create `tests/features/reports/pipelineTrackerSteps.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportPipelineTracker } from '@/features/reports/components/ReportPipelineTracker'
import type { RescueReport } from '@/features/reports/domain/rescueReports'

describe('ReportPipelineTracker', () => {
  it('renders 5 steps for standard field rescue report', () => {
    const report: Partial<RescueReport> = {
      id: 'r1',
      status: 'logged',
      intake_source: 'citizen',
      created_at: new Date().toISOString(),
    }
    render(<ReportPipelineTracker report={report as RescueReport} />)
    expect(screen.getByText('Report Logged')).toBeInTheDocument()
    expect(screen.getByText('Triage Decision')).toBeInTheDocument()
    expect(screen.getByText('Field & Transport')).toBeInTheDocument()
    expect(screen.getByText('Animal Attended')).toBeInTheDocument()
    expect(screen.getByText('Outcome & Placement')).toBeInTheDocument()
  })

  it('renders 3 steps for direct walk-in report', () => {
    const report: Partial<RescueReport> = {
      id: 'r2',
      status: 'attended',
      intake_source: 'walk_in',
      created_at: new Date().toISOString(),
    }
    render(<ReportPipelineTracker report={report as RescueReport} />)
    expect(screen.getByText('Intake Logged')).toBeInTheDocument()
    expect(screen.getByText('Admitted / In Custody')).toBeInTheDocument()
    expect(screen.getByText('Outcome & Placement')).toBeInTheDocument()
    expect(screen.queryByText('Field & Transport')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/features/reports/pipelineTrackerSteps.test.tsx`
Expected: FAIL (5-step and 3-step not yet in ReportPipelineTracker)

- [ ] **Step 3: Implement 5-step and 3-step in `ReportPipelineTracker.tsx`**

Update `ReportPipelineTracker.tsx` to detect `isWalkIn = report.intake_source === 'walk_in' || report.intake_source === 'direct_intake'`.
For walk-in: render 3 steps.
For emergency field: render 5 steps (including Step 5: "Outcome & Placement").
Evaluate Step 5 status using linked animal outcome (shows Completed if animal has exit status, or Active/Current if animal is still in care).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/features/reports/pipelineTrackerSteps.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/components/ReportPipelineTracker.tsx tests/features/reports/pipelineTrackerSteps.test.tsx
git commit -m "feat(reports): support 5-step field pipeline and 3-step walk-in pipeline"
```

---

### Task 4: Backdatable Date/Time & Walk-in Form in `ReportIntakeScreen`

**Files:**
- Modify: `src/features/reports/screens/ReportIntakeScreen.tsx`
- Modify: `src/features/reports/domain/rescueReports.ts`
- Test: `tests/features/reports/reportDateTimeIntake.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` (`?type=walk-in`), `toDatetimeLocalValue`
- Produces: `createdAt` support in `CreateRescueReportInput` and `updateRescueReport`

- [ ] **Step 1: Write the failing test**

Create `tests/features/reports/reportDateTimeIntake.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReportIntakeScreen } from '@/features/reports/screens/ReportIntakeScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: vi.fn(() => ({})),
}))
vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: vi.fn(() => ({ member: { orgId: 'org-1', orgInitials: 'SANCTUARY' } })),
}))

describe('ReportIntakeScreen', () => {
  it('renders date & time input for backdating', () => {
    render(
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path="/reports/new" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByLabelText(/Report Date & Time|Intake Date & Time/i)).toBeInTheDocument()
  })

  it('renders Walk-in title and default walk_in source when ?type=walk-in', () => {
    render(
      <MemoryRouter initialEntries={['/reports/new?type=walk-in']}>
        <Routes>
          <Route path="/reports/new" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: /Log Walk-in Intake/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/features/reports/reportDateTimeIntake.test.tsx`
Expected: FAIL (label and walk-in title not found)

- [ ] **Step 3: Implement Date/Time picker and Walk-in mode in `ReportIntakeScreen`**

1. Read `searchParams.get('type') === 'walk-in'`.
2. Add `reportDateTime` field at the top of the form, defaulting to `toDatetimeLocalValue(new Date())`.
3. Support `createdAt?: string` in `createRescueReport` (sets `created_at` and `stage_logged_at`).
4. If walk-in:
   - On submit, automatically set status = `'attended'`, `stage_attended_at = reportDateTime`, `disposition_type = 'admitted_shelter'`, and create the animal record right away so the animal is immediately in custody!
   - Redirect to the newly created report or animal.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/features/reports/reportDateTimeIntake.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/screens/ReportIntakeScreen.tsx src/features/reports/domain/rescueReports.ts tests/features/reports/reportDateTimeIntake.test.tsx
git commit -m "feat(reports): add backdatable date/time and direct walk-in intake flow"
```

---

### Task 5: "Log report" Split Button Dropdown ("Log walk-in") & Filter Updates

**Files:**
- Modify: `src/features/reports/screens/ReportsListScreen.tsx`
- Modify: `src/features/reports/components/ReportTimelineCard.tsx`
- Modify: `src/features/reports/screens/ReportDetailScreen.tsx`
- Test: `tests/features/reports/reportsListActions.test.tsx`

**Interfaces:**
- Consumes: `ReportTimelineCard`, `getReportCompletionStatus`
- Produces: `.split-btn-group` on ReportsListScreen with main button "Log report" and dropdown menu containing "Log walk-in", dynamic "Completed" status tag when all linked animals have left care.

- [ ] **Step 1: Write the failing test**

Create `tests/features/reports/reportsListActions.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReportsListScreen } from '@/features/reports/screens/ReportsListScreen'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([
      { id: 'rep-1', status: 'logged', created_at: new Date().toISOString() },
    ]),
  })),
}))
vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: vi.fn(() => ({ member: { orgId: 'org-1', orgName: 'Shelter' } })),
}))

describe('ReportsListScreen Actions', () => {
  it('renders split button with Log report and opens dropdown with Log walk-in', async () => {
    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /Log report/i })).toBeInTheDocument()
    const toggleBtn = screen.getByTitle(/More report actions/i)
    expect(toggleBtn).toBeInTheDocument()
    fireEvent.click(toggleBtn)
    expect(screen.getByRole('link', { name: /Log walk-in/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/features/reports/reportsListActions.test.tsx`
Expected: FAIL (`toggleBtn` not found)

- [ ] **Step 3: Implement split button dropdown and Completed badge updates**

1. In `ReportsListScreen.tsx`: Replace single "Log report" `<Button>` with a `.split-btn-group` (matching the style in `ReportDetailScreen.tsx`):
   - Primary link/button: `to="/reports/new"` with text "Log report" and `<Plus size={18} weight="bold" />`.
   - Dropdown toggle: `<button type="button" className="btn-toggle pressable" title="More report actions"><CaretDown size={14} weight="bold" /></button>`.
   - Dropdown menu: `<Link to="/reports/new?type=walk-in" className="dropdown-item"><SignIn size={15} weight="bold" /><span>Log walk-in</span></Link>`.
2. In `ReportTimelineCard.tsx`: If the report is completed (all linked animals have exit outcome or spot_released/doa), display the Completed badge.
3. In `ReportsListScreen.tsx`: In the filter logic, if filtered by `completed`, include reports whose linked animals are all completed. If filtered by `in_progress`, keep reports whose linked animals are still in care.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/features/reports/reportsListActions.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/screens/ReportsListScreen.tsx src/features/reports/components/ReportTimelineCard.tsx tests/features/reports/reportsListActions.test.tsx
git commit -m "feat(reports): add log report split button dropdown and animal-linked completion badges"
```

---

### Task 6: Full Verification & Build Gate

**Files:**
- All modified files
- Verification: Full test suite + production build

- [ ] **Step 1: Run all unit tests**
Run: `npm test -- --run`
Expected: 100% tests pass with 0 failures.

- [ ] **Step 2: Run production build**
Run: `npm run build`
Expected: Exit code 0, 0 errors.

- [ ] **Step 3: Verify preview server**
Check `https://sanctuary-app.sohaibbinmohsin.com` to verify responsive display, "Log walk-in" button, and 5-step / 3-step pipeline.
