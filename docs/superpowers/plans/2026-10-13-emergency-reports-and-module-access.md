# Emergency Reports Integration & Organization Module Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the emergency rescue reports workflow from the prototype into the core application with database-backed organization-level module access control and presets.

**Architecture:** Extend PowerSync/SQLite schema with `rescue_reports`, `report_photos`, and `organizations.enabled_modules`. Provide dynamic app shell navigation filtering by enabled modules, a settings panel for Super Admins to manage organization modules with presets, and port the responsive Reports feed and detail view into production React components.

**Tech Stack:** React 18, TypeScript, React Router 6, PowerSync SQLite (`@powersync/web`, `@powersync/react`), Phosphor Icons, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-13-emergency-reports-and-module-access-design.md`

## Global Constraints

- Light theme only, strictly adhering to Sanctuary design tokens (`--color-forest`, `--color-forest-soft`, `--color-stone`, `--color-amber`, etc.).
- Outlined fonts: Outfit for display headers, DM Sans for body/controls, DM Mono for shelter codes and report IDs (`PARC-R105`).
- Touch targets >= 44px minimum touch area.
- No direct pushes to main under any circumstances.
- Offline-first execution via PowerSync (`SanctuaryDb`).
- Mandatory build verification: Full production build (`npm run build`) must pass with 0 errors before completion.
- Citizen reporter information is always confidential/internal (no anonymous toggle).

---

### Task 1: Schema & Domain Layer for Organization Modules & Rescue Reports

**Files:**
- Modify: `src/features/sync/powersync/schema.ts`
- Create: `src/shared/domain/modules.ts`
- Modify: `src/shared/hooks/useCurrentMember.ts`
- Test: `tests/unit/modules/organizationModules.test.ts`

**Interfaces:**
- Produces:
  - `AppModuleId`: `'reports' | 'animals' | 'checklist' | 'ledger'`
  - `MODULE_PRESETS`: Record of presets (`'full'`, `'sanctuary_only'`, `'hotline'`, `'clinic'`, `'custom'`)
  - `parseEnabledModules(raw: string | null | undefined): Set<AppModuleId>`
  - `formatEnabledModules(modules: Iterable<AppModuleId>): string`
  - `CurrentMember.enabledModules`: `Set<AppModuleId>`
  - `CurrentMember.hasModule(module: AppModuleId): boolean`
  - Schema tables: `organizations.enabled_modules`, `rescue_reports`, `report_photos`

- [ ] **Step 1: Write failing test for module domain parsing and presets**

Create `tests/unit/modules/organizationModules.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  parseEnabledModules,
  formatEnabledModules,
  MODULE_PRESETS,
  type AppModuleId,
} from '@/shared/domain/modules'

describe('organizationModules', () => {
  it('defaults to all modules when raw is null, undefined, or empty', () => {
    const modules = parseEnabledModules(null)
    expect(modules.has('reports')).toBe(true)
    expect(modules.has('animals')).toBe(true)
    expect(modules.has('checklist')).toBe(true)
    expect(modules.has('ledger')).toBe(true)
  })

  it('correctly parses JSON array of modules', () => {
    const modules = parseEnabledModules(JSON.stringify(['animals', 'checklist']))
    expect(modules.has('animals')).toBe(true)
    expect(modules.has('checklist')).toBe(true)
    expect(modules.has('reports')).toBe(false)
    expect(modules.has('ledger')).toBe(false)
  })

  it('formats modules into clean JSON string', () => {
    const json = formatEnabledModules(['animals', 'reports'])
    const parsed = JSON.parse(json)
    expect(parsed).toEqual(['animals', 'reports'])
  })

  it('provides standard presets matching requirements', () => {
    expect(MODULE_PRESETS.full).toEqual(['reports', 'animals', 'checklist', 'ledger'])
    expect(MODULE_PRESETS.sanctuary_only).toEqual(['animals', 'checklist', 'ledger'])
    expect(MODULE_PRESETS.hotline).toEqual(['reports', 'animals'])
    expect(MODULE_PRESETS.clinic).toEqual(['animals', 'checklist'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/modules/organizationModules.test.ts`  
Expected: FAIL (Cannot find module `@/shared/domain/modules`)

- [ ] **Step 3: Implement `src/shared/domain/modules.ts`, update schema and `useCurrentMember`**

Create `src/shared/domain/modules.ts`:
```ts
export type AppModuleId = 'reports' | 'animals' | 'checklist' | 'ledger'

export const ALL_MODULE_IDS: readonly AppModuleId[] = [
  'reports',
  'animals',
  'checklist',
  'ledger',
] as const

export const MODULE_PRESETS = {
  full: ['reports', 'animals', 'checklist', 'ledger'],
  sanctuary_only: ['animals', 'checklist', 'ledger'],
  hotline: ['reports', 'animals'],
  clinic: ['animals', 'checklist'],
} as const satisfies Record<string, readonly AppModuleId[]>

export type ModulePresetKey = keyof typeof MODULE_PRESETS | 'custom'

export function parseEnabledModules(raw: string | null | undefined): Set<AppModuleId> {
  if (!raw || !raw.trim()) {
    return new Set(ALL_MODULE_IDS)
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((m): m is AppModuleId =>
        ALL_MODULE_IDS.includes(m as AppModuleId),
      )
      return new Set(valid.length > 0 ? valid : ALL_MODULE_IDS)
    }
  } catch {
    // fallback comma-separated
    const parts = raw.split(',').map((p) => p.trim())
    const valid = parts.filter((m): m is AppModuleId =>
      ALL_MODULE_IDS.includes(m as AppModuleId),
    )
    if (valid.length > 0) return new Set(valid)
  }
  return new Set(ALL_MODULE_IDS)
}

export function formatEnabledModules(modules: Iterable<AppModuleId>): string {
  return JSON.stringify(Array.from(modules))
}
```

In `src/features/sync/powersync/schema.ts`:
- Add `enabled_modules: column.text` to `organizations` table.
- Add `rescue_reports` table:
```ts
const rescue_reports = new Table(
  {
    org_id: column.text,
    report_number: column.text,
    category: column.text,
    species: column.text,
    chief_complaint: column.text,
    status: column.text,
    location_area: column.text,
    location_landmark: column.text,
    reporter_name: column.text,
    reporter_phone: column.text,
    disposition_type: column.text,
    animal_id: column.text,
    stage_logged_at: column.text,
    stage_accepted_at: column.text,
    stage_dispatched_at: column.text,
    stage_attended_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      by_org: ['org_id'],
      by_status: ['status'],
      by_animal: ['animal_id'],
    },
  },
)

const report_photos = new Table(
  {
    org_id: column.text,
    report_id: column.text,
    r2_key: column.text,
    local_only: column.integer,
    upload_state: column.text,
    created_at: column.text,
  },
  { indexes: { by_report: ['report_id'] } },
)
```
- Register `rescue_reports` and `report_photos` in `AppSchema`. Export `RescueReportRecord` and `ReportPhotoRecord`.

In `src/shared/hooks/useCurrentMember.ts`:
- Update `CurrentMember` to include:
  ```ts
  enabledModules: Set<AppModuleId>
  hasModule: (module: AppModuleId) => boolean
  ```
- In `mapMemberRow`, populate `enabledModules: parseEnabledModules(row.org_enabled_modules)` and helper `hasModule: (m) => enabledModules.has(m)`.
- Update `MemberRow` and SQL query select to include `o.enabled_modules as org_enabled_modules`.

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run tests/unit/modules/organizationModules.test.ts`  
Expected: PASS

- [ ] **Step 5: Verify build & commit**

Run: `npm run build`  
Commit:
```bash
git add src/features/sync/powersync/schema.ts src/shared/domain/modules.ts src/shared/hooks/useCurrentMember.ts tests/unit/modules/organizationModules.test.ts
git commit -m "feat(modules): add rescue_reports schema, org enabled_modules, and domain presets"
```

---

### Task 2: Dynamic Navigation & Route Protection Based on Org Enabled Modules

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/unit/navigation/moduleNavigation.test.tsx`

**Interfaces:**
- Consumes: `useCurrentMember().member.hasModule`
- Produces: Dynamic navigation in `AppShell` with fallback redirect for disabled routes

- [ ] **Step 1: Write failing test for dynamic navigation and route redirection**

Create `tests/unit/navigation/moduleNavigation.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '@/app/router'
import * as useCurrentMemberModule from '@/shared/hooks/useCurrentMember'

vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => ({}) }))
vi.mock('@/features/uploads/hooks/useMediaUploadRunner', () => ({ useMediaUploadRunner: () => {} }))
vi.mock('@/features/uploads/hooks/usePendingMedia', () => ({ usePendingMedia: () => ({ items: [] }) }))

describe('AppShell Module Navigation', () => {
  it('shows only enabled modules in navigation', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Hotline Org',
        orgInitials: 'HO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['reports', 'animals']),
        hasModule: (m) => m === 'reports' || m === 'animals',
      },
    })

    render(
      <MemoryRouter initialEntries={['/animals']}>
        <AppShell />
      </MemoryRouter>,
    )

    // Reports and Animals should exist
    expect(screen.getAllByText('Animals').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0)

    // Ledger and Checklist should NOT be rendered in nav
    expect(screen.queryByText('Ledger')).toBeNull()
    expect(screen.queryByText('Checklist')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/navigation/moduleNavigation.test.tsx`  
Expected: FAIL (Ledger is still rendered, Reports is missing)

- [ ] **Step 3: Implement dynamic navigation and module filtering in `src/app/router.tsx`**

In `src/app/router.tsx`:
1. Import `Lifebuoy` or `MegaphoneSimple` from `@phosphor-icons/react` for Reports icon.
2. Define nav configs associated with module IDs:
   ```ts
   const MODULE_NAV_DEFINITIONS = [
     { id: 'reports', to: '/reports', label: 'Reports', icon: MegaphoneSimple },
     { id: 'animals', to: '/animals', label: 'Animals', icon: Cat },
     { id: 'ledger', to: '/ledger', label: 'Ledger', icon: CurrencyCircleDollar },
     { id: 'checklist', to: '/checklist', label: 'Checklist', icon: CheckSquare },
   ] as const
   ```
3. Dynamically build `SIDEBAR_NAV` and `BOTTOM_NAV` filtering by `member?.hasModule(id)`. Always include Overview (`/dashboard`), Uploads (`/uploads`), and Settings (`/settings`).
4. In route definitions, wrap routes with a check:
   - If user visits `/ledger` but `!hasModule('ledger')`, redirect to `/animals` or `/reports`.
   - Add placeholder or real `/reports` and `/reports/:id` route definitions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/navigation/moduleNavigation.test.tsx`  
Expected: PASS

- [ ] **Step 5: Verify build & commit**

Run: `npm run build`  
Commit:
```bash
git add src/app/router.tsx src/app/App.tsx tests/unit/navigation/moduleNavigation.test.tsx
git commit -m "feat(navigation): filter sidebar and bottom nav items by org enabled modules"
```

---

### Task 3: Organization Module Configuration UI in Settings

**Files:**
- Create: `src/features/settings/components/OrganizationModulesCard.tsx`
- Modify: `src/features/settings/screens/SettingsScreen.tsx`
- Modify: `src/features/settings/domain/settings.ts`
- Test: `tests/unit/settings/organizationModulesCard.test.tsx`

**Interfaces:**
- Consumes: `useCurrentMember`, `SanctuaryDb`, `MODULE_PRESETS`
- Produces: UI component for admins to select account preset or toggle individual module checkboxes and save to SQLite/PowerSync.

- [ ] **Step 1: Write failing test for OrganizationModulesCard**

Create `tests/unit/settings/organizationModulesCard.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OrganizationModulesCard } from '@/features/settings/components/OrganizationModulesCard'

describe('OrganizationModulesCard', () => {
  it('renders presets and individual module checkboxes', () => {
    const onSave = vi.fn()
    render(
      <OrganizationModulesCard
        enabledModules={new Set(['animals', 'checklist'])}
        canManage={true}
        onSave={onSave}
      />,
    )

    expect(screen.getByText('Organization Modules')).toBeInTheDocument()
    expect(screen.getByLabelText(/Rescue Reports/i)).not.toBeChecked()
    expect(screen.getByLabelText(/Animal Records/i)).toBeChecked()
    expect(screen.getByLabelText(/Daily Checklist/i)).toBeChecked()
    expect(screen.getByLabelText(/Financial Ledger/i)).not.toBeChecked()
  })

  it('updates checkboxes when selecting a preset', () => {
    const onSave = vi.fn()
    render(
      <OrganizationModulesCard
        enabledModules={new Set(['animals'])}
        canManage={true}
        onSave={onSave}
      />,
    )

    const presetSelect = screen.getByLabelText(/Account Preset/i)
    fireEvent.change(presetSelect, { target: { value: 'full' } })

    expect(screen.getByLabelText(/Rescue Reports/i)).toBeChecked()
    expect(screen.getByLabelText(/Animal Records/i)).toBeChecked()
    expect(screen.getByLabelText(/Daily Checklist/i)).toBeChecked()
    expect(screen.getByLabelText(/Financial Ledger/i)).toBeChecked()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/settings/organizationModulesCard.test.tsx`  
Expected: FAIL (Component does not exist)

- [ ] **Step 3: Implement `OrganizationModulesCard` and save function in settings domain**

1. Create `src/features/settings/components/OrganizationModulesCard.tsx`:
   - Preset dropdown: Full Sanctuary & Rescue, Sanctuary Only, Rescue Hotline, Clinic/Foster, Custom.
   - Checkboxes with descriptions:
     - Rescue Reports: *Triage incoming rescue calls, dispatch field rescue teams, track response stages.*
     - Animal Records: *Shelter roster, care notes, medical history, life stages, and animal relationships.*
     - Daily Checklist: *Daily feeding, cleaning, and wellness task execution.*
     - Financial Ledger: *Donations, medical expense tracking, receipt proof verification.*
   - Primary Green "Save modules" button (`variant="primary"`).
2. In `src/features/settings/domain/settings.ts`, add:
   ```ts
   export async function updateOrganizationModules(
     db: SanctuaryDb,
     orgId: string,
     modules: AppModuleId[],
   ): Promise<void>
   ```
3. Mount `<OrganizationModulesCard />` inside `SettingsScreen.tsx` for admin members.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/settings/organizationModulesCard.test.tsx`  
Expected: PASS

- [ ] **Step 5: Verify build & commit**

Run: `npm run build`  
Commit:
```bash
git add src/features/settings/components/OrganizationModulesCard.tsx src/features/settings/domain/settings.ts src/features/settings/screens/SettingsScreen.tsx tests/unit/settings/organizationModulesCard.test.tsx
git commit -m "feat(settings): add OrganizationModulesCard with presets and live toggle"
```

---

### Task 4: Rescue Reports Domain & Data Access Layer (`rescueReports.ts`)

**Files:**
- Create: `src/features/reports/domain/rescueReports.ts`
- Test: `tests/unit/reports/rescueReportsDomain.test.ts`

**Interfaces:**
- Produces:
  - `RescueReport` interface
  - `createRescueReport(db, input)`
  - `updateReportStage(db, reportId, stage)`
  - `completeReportWithDisposition(db, reportId, disposition, animalId?)`
  - `generateReportNumber(db, orgInitials)`
  - `getRescueReports(db, orgId, filter?)`
  - `getRescueReportById(db, reportId)`

- [ ] **Step 1: Write failing tests for report creation, stage transitions, and disposition**

Create `tests/unit/reports/rescueReportsDomain.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRescueReport,
  updateReportStage,
  completeReportWithDisposition,
  generateReportNumber,
} from '@/features/reports/domain/rescueReports'

describe('rescueReports domain', () => {
  it('generates sequential report numbers with prefix', async () => {
    const mockDb = {
      getOptional: async () => ({ count: 5 }),
    } as any
    const code = await generateReportNumber(mockDb, 'PARC')
    expect(code).toBe('PARC-R106')
  })

  it('creates an emergency report with logged stage and confidential reporter', async () => {
    let executedSql = ''
    let executedParams: any[] = []
    const mockDb = {
      execute: async (sql: string, params: any[]) => {
        executedSql = sql
        executedParams = params
      },
    } as any

    const report = await createRescueReport(mockDb, {
      orgId: 'org-1',
      reportNumber: 'PARC-R106',
      species: 'donkey',
      chiefComplaint: 'Collapsed under cart',
      locationArea: 'Burns Road',
      locationLandmark: 'Opposite Fresco',
      reporterName: 'Usman Ali',
      reporterPhone: '0300-1234567',
    })

    expect(report.status).toBe('logged')
    expect(report.category).toBe('emergency')
    expect(report.stage_logged_at).toBeDefined()
  })

  it('transitions report stage cleanly', async () => {
    let executedSql = ''
    let executedParams: any[] = []
    const mockDb = {
      execute: async (sql: string, params: any[]) => {
        executedSql = sql
        executedParams = params
      },
    } as any

    await updateReportStage(mockDb, 'rep-1', 'dispatched')
    expect(executedSql).toContain('UPDATE rescue_reports')
    expect(executedParams).toContain('dispatched')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/rescueReportsDomain.test.ts`  
Expected: FAIL (Cannot find module `@/features/reports/domain/rescueReports`)

- [ ] **Step 3: Implement `src/features/reports/domain/rescueReports.ts`**

Implement domain functions:
- Sequential human-readable report codes `PARC-R101`, `PARC-R102`, etc.
- Safe transactions for stage updates (`logged` -> `accepted` -> `dispatched` -> `attended`).
- Attended disposition handling:
  - `'spot_released'`: sets `disposition_type = 'spot_released'`, marks report attended.
  - `'admitted_shelter'`: optionally creates new animal in `animals` table with next `shelter_code`, sets `animal_id` on the report.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reports/rescueReportsDomain.test.ts`  
Expected: PASS

- [ ] **Step 5: Verify build & commit**

Run: `npm run build`  
Commit:
```bash
git add src/features/reports/domain/rescueReports.ts tests/unit/reports/rescueReportsDomain.test.ts
git commit -m "feat(reports): implement rescueReports domain logic, sequential IDs, and disposition"
```

---

### Task 5: Reports Timeline Screen (`/reports`) & Log Report Modal (`+ Log report`)

**Files:**
- Create: `src/features/reports/screens/ReportsListScreen.tsx`
- Create: `src/features/reports/components/ReportTimelineCard.tsx`
- Create: `src/features/reports/components/LogReportModal.tsx`
- Create: `src/features/reports/reports.css`
- Modify: `src/app/router.tsx`
- Test: `tests/unit/reports/reportsListScreen.test.tsx`

**Interfaces:**
- Consumes: `useDb`, `useCurrentMember`, `getRescueReports`, `createRescueReport`
- Produces: Timeline feed at `/reports`, search/filter tabs, and modal for adding new report.

- [ ] **Step 1: Write failing test for ReportsListScreen**

Create `tests/unit/reports/reportsListScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ReportsListScreen } from '@/features/reports/screens/ReportsListScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'

vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => ({}) }))
vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'PARC' },
  }),
}))

describe('ReportsListScreen', () => {
  it('renders timeline grouped reports and header button', async () => {
    vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([
      {
        id: 'rep-1',
        org_id: 'org-1',
        report_number: 'PARC-R105',
        category: 'emergency',
        species: 'dog',
        chief_complaint: 'Hit by rickshaw • Fractured leg',
        status: 'logged',
        location_area: 'Burns Road',
        location_landmark: 'Near Fresco',
        reporter_name: 'Usman',
        reporter_phone: '0300-1234567',
        created_at: new Date().toISOString(),
      } as any,
    ])

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R105')).toBeInTheDocument()
    expect(screen.getByText('DOG')).toBeInTheDocument()
    expect(screen.getByText(/Hit by rickshaw/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ Log report/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/reportsListScreen.test.tsx`  
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `ReportsListScreen`, `ReportTimelineCard`, and `LogReportModal`**

1. Create `ReportTimelineCard`:
   - Left time column (`14:10`, relative elapsed time `25m ago`).
   - Clean card:
     - Header: `[report_number] · [SPECIES]` + centered status badge (`New Report`, `Dispatched`, `At Partner Vet`, `In Shelter`).
     - Complaint line with text truncation.
   - Entire card clickable (`navigate(/reports/${report.id})`).
2. Create `LogReportModal`:
   - Using `ResponsiveSheetModal`.
   - Fields: Species pills (Dog, Cat, Donkey, Horse, Bird, Other), Chief Complaint, Location, Landmark, Reporter Name, Reporter Phone (no anonymous toggle).
   - Brand Green Submit button (`variant="primary"`).
3. Connect in `ReportsListScreen`:
   - Filter segments (`All`, `New reports`, `In progress`, `Completed`).
   - Date groupings (`Today`, `Yesterday`, etc.).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reports/reportsListScreen.test.tsx`  
Expected: PASS

- [ ] **Step 5: Verify build & commit**

Run: `npm run build`  
Commit:
```bash
git add src/features/reports/screens/ReportsListScreen.tsx src/features/reports/components/ReportTimelineCard.tsx src/features/reports/components/LogReportModal.tsx src/features/reports/reports.css tests/unit/reports/reportsListScreen.test.tsx src/app/router.tsx
git commit -m "feat(reports): build ReportsListScreen timeline feed and LogReportModal"
```

---

### Task 6: Report Detail Screen (`/reports/:id`) with Pipeline & Disposition Actions

**Files:**
- Create: `src/features/reports/screens/ReportDetailScreen.tsx`
- Create: `src/features/reports/components/ReportPipelineTracker.tsx`
- Create: `src/features/reports/components/ReportFactsGrid.tsx`
- Modify: `src/app/router.tsx`
- Test: `tests/unit/reports/reportDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `useDb`, `useCurrentMember`, `getRescueReportById`, `updateReportStage`, `completeReportWithDisposition`
- Produces: Unboxed detail header, dynamic stage split button, timestamp pipeline tracker, facts grid, and animal admission / spot release disposition.

- [ ] **Step 1: Write failing test for ReportDetailScreen**

Create `tests/unit/reports/reportDetailScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReportDetailScreen } from '@/features/reports/screens/ReportDetailScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'

vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => ({}) }))
vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'PARC' },
  }),
}))

describe('ReportDetailScreen', () => {
  it('renders report ID, status badge, pipeline, and stage action button', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      category: 'emergency',
      species: 'dog',
      chief_complaint: 'Hit by rickshaw • Fracture',
      status: 'logged',
      location_area: 'Burns Road',
      location_landmark: 'Near Fresco',
      reporter_name: 'Usman',
      reporter_phone: '0300-1234567',
      stage_logged_at: '2026-10-13T14:10:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R105')).toBeInTheDocument()
    expect(screen.getByText(/New Report \(Awaiting Decision\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accept & Triage/i })).toBeInTheDocument()
    expect(screen.getByText('Burns Road')).toBeInTheDocument()
    expect(screen.getByText('0300-1234567')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reports/reportDetailScreen.test.tsx`  
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `ReportDetailScreen`, `ReportPipelineTracker`, and `ReportFactsGrid`**

1. Create `ReportPipelineTracker`:
   - Horizontal pipeline stepper showing stages: `Report Logged`, `Triage Decision`, `Field & Transport`, `Animal Attended`.
   - Displays real timestamp underneath each completed stage.
2. Create `ReportFactsGrid`:
   - Photos & Proof card.
   - Condition & Animal card (Medical emergency badge, Species, Chief complaint).
   - Location & Landmark card.
   - Reporter Information card with direct `Call` button (telephone link `tel:0300...`).
3. Create `ReportDetailScreen`:
   - Back button to `/reports`.
   - Top header: `PARC-R105` + Centered status badge.
   - Top-right stage split button in Brand Amber/Orange (`rgb(222, 107, 43)`):
     - Stage `logged`: `Accept & Triage` (dropdown: `Cancel Report`).
     - Stage `accepted`: `Dispatch Ambulance`.
     - Stage `dispatched`: `Mark Attended`.
     - Stage `attended`: Modal / split choices:
       - `Spot Release (TNR)`: completes report, status updated.
       - `Admit to Shelter`: creates permanent animal in system, opens Animal record or links to existing shelter code.
4. Mount `/reports/:id` in `src/app/router.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reports/reportDetailScreen.test.tsx`  
Expected: PASS

- [ ] **Step 5: Full verification & build check**

Run:
1. `npm test -- --run`
2. `npm run build`
Verify all unit tests pass and build exits with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/screens/ReportDetailScreen.tsx src/features/reports/components/ReportPipelineTracker.tsx src/features/reports/components/ReportFactsGrid.tsx src/app/router.tsx tests/unit/reports/reportDetailScreen.test.tsx
git commit -m "feat(reports): build ReportDetailScreen with pipeline tracker and disposition transitions"
```
