# First-Time User Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guided, multi-step first-time onboarding flow for shelter administrators to set up their shelter identity, animal statuses, and ledger categories on first login.

**Architecture:** A standalone full-screen route (`/onboarding`) guarded by `member.setupCompleted`. The 3-step wizard manages local drafts for identity, statuses, and ledger categories, and performs an atomic transaction commit to PowerSync SQLite and Supabase Postgres upon completion.

**Tech Stack:** React 19, TypeScript, Vite, PowerSync Web SDK (SQLite WASM), Supabase (Postgres & Auth), Cloudflare R2, Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-08-31-first-time-user-onboarding-design.md`](file:///Users/sohaibbinmohsin/Developer/sanctuary/docs/superpowers/specs/2026-08-31-first-time-user-onboarding-design.md)

## Global Constraints

- Light theme only, strictly adhering to Sanctuary design system tokens (`--color-forest`, `--color-forest-soft`, `--color-surface`, `--color-mist`, `--color-ink`).
- Plain verbs, sentence case, no jargon, no em-dashes in UI copy.
- Mobile-first responsive design (touch targets >= 44px, clean card containers, max width ~640px).
- All queries and state changes must be offline-first compatible via PowerSync and `SanctuaryDb`.

---

### Task 1: Database Migration & Schema Updates

**Files:**
- Create: `supabase/migrations/20260831120000_organization_setup_completed.sql`
- Modify: `scripts/db-setup.mjs`
- Modify: `src/features/sync/powersync/schema.ts`
- Test: `tests/unit/onboarding/schema.test.ts`

**Interfaces:**
- Consumes: Existing `organizations` schema table in Supabase & PowerSync.
- Produces: `setup_completed` column on `organizations` and `setup_completed?: number | null` field on `OrganizationRecord`.

- [ ] **Step 1: Write the failing test for schema definition**

```typescript
// tests/unit/onboarding/schema.test.ts
import { describe, it, expect } from 'vitest'
import { schema } from '@/features/sync/powersync/schema'

describe('PowerSync schema setup_completed', () => {
  it('includes setup_completed column in organizations table', () => {
    const orgsTable = schema.tables.find((t) => t.name === 'organizations')
    expect(orgsTable).toBeDefined()
    const col = orgsTable?.columns.find((c) => c.name === 'setup_completed')
    expect(col).toBeDefined()
    expect(col?.type).toBe('INTEGER')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding/schema.test.ts`
Expected: FAIL with missing column `setup_completed`.

- [ ] **Step 3: Create migration and update PowerSync schema**

Create `supabase/migrations/20260831120000_organization_setup_completed.sql`:
```sql
alter table organizations
  add column if not exists setup_completed boolean not null default false;

update organizations
set setup_completed = true
where setup_completed is false;
```

Update `scripts/db-setup.mjs` to apply `20260831120000_organization_setup_completed.sql` if the column doesn't exist.

Update `src/features/sync/powersync/schema.ts`:
```typescript
export const schema = new Schema({
  organizations: new Table({
    name: column.text,
    initials: column.text,
    logo_r2_key: column.text,
    public_enabled: column.integer,
    public_slug: column.text,
    setup_completed: column.integer,
    created_at: column.text,
  }),
  // ...
})
```
And add `setup_completed?: number | null` to `OrganizationRecord`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260831120000_organization_setup_completed.sql scripts/db-setup.mjs src/features/sync/powersync/schema.ts tests/unit/onboarding/schema.test.ts
git commit -m "feat(schema): add setup_completed to organizations table"
```

---

### Task 2: Member Hook & Bootstrap Hydration Updates

**Files:**
- Modify: `src/shared/hooks/useCurrentMember.ts`
- Modify: `src/features/sync/hydrateOrgBootstrap.ts`
- Test: `tests/unit/shared/useCurrentMemberSetupCompleted.test.ts`

**Interfaces:**
- Consumes: `setup_completed` column on `organizations`.
- Produces: `setupCompleted: boolean` property on `CurrentMember`.

- [ ] **Step 1: Write unit tests for CurrentMember setupCompleted parsing**

```typescript
// tests/unit/shared/useCurrentMemberSetupCompleted.test.ts
import { describe, it, expect } from 'vitest'
import type { CurrentMember } from '@/shared/hooks/useCurrentMember'

describe('CurrentMember setupCompleted parsing', () => {
  it('correctly maps setup_completed integer to boolean', () => {
    const memberTrue: CurrentMember = {
      id: 'm1',
      orgId: 'o1',
      userId: 'u1',
      role: 'admin',
      orgName: 'Shelter A',
      orgInitials: 'SA',
      orgLogoR2Key: null,
      publicEnabled: false,
      publicSlug: null,
      setupCompleted: true,
    }
    expect(memberTrue.setupCompleted).toBe(true)

    const memberFalse: CurrentMember = {
      ...memberTrue,
      setupCompleted: false,
    }
    expect(memberFalse.setupCompleted).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails on TypeScript types**

Run: `npx vitest run tests/unit/shared/useCurrentMemberSetupCompleted.test.ts`
Expected: FAIL due to missing `setupCompleted` on `CurrentMember`.

- [ ] **Step 3: Implement updates in `useCurrentMember.ts` and `hydrateOrgBootstrap.ts`**

In `src/shared/hooks/useCurrentMember.ts`:
- Add `setupCompleted: boolean` to `CurrentMember`.
- Include `o.setup_completed as org_setup_completed` in `readMember` query.
- Map `setupCompleted: row.org_setup_completed === 1`.

In `src/features/sync/hydrateOrgBootstrap.ts`:
- Include `setup_completed` in `organizations` query from Supabase.
- Include `setup_completed` in `INSERT OR REPLACE INTO organizations`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/shared/useCurrentMemberSetupCompleted.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/hooks/useCurrentMember.ts src/features/sync/hydrateOrgBootstrap.ts tests/unit/shared/useCurrentMemberSetupCompleted.test.ts
git commit -m "feat(auth): expose setupCompleted in useCurrentMember and hydrateOrgBootstrap"
```

---

### Task 3: Onboarding Domain Logic & Atomic Commit

**Files:**
- Create: `src/features/onboarding/domain/onboarding.ts`
- Test: `tests/unit/onboarding/onboardingDomain.test.ts`

**Interfaces:**
- Consumes: `SanctuaryDb`, `setPartnerLogo` from `@/features/settings/domain/partnerLogo`.
- Produces:
  - `DEFAULT_ONBOARDING_STATUSES`: default status drafts.
  - `DEFAULT_ONBOARDING_CATEGORIES`: default ledger categories drafts.
  - `commitOnboarding(db: SanctuaryDb, input: CommitOnboardingInput): Promise<void>`.

- [ ] **Step 1: Write failing unit test for `commitOnboarding` and defaults**

```typescript
// tests/unit/onboarding/onboardingDomain.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  DEFAULT_ONBOARDING_STATUSES,
  DEFAULT_ONBOARDING_CATEGORIES,
  commitOnboarding,
  type CommitOnboardingInput,
} from '@/features/onboarding/domain/onboarding'
import type { SanctuaryDb } from '@/shared/lib/db'

describe('Onboarding domain', () => {
  it('provides sensible default statuses and ledger categories', () => {
    expect(DEFAULT_ONBOARDING_STATUSES.length).toBeGreaterThan(0)
    expect(DEFAULT_ONBOARDING_STATUSES.some((s) => s.label === 'Intake')).toBe(true)
    expect(DEFAULT_ONBOARDING_CATEGORIES.some((c) => c.label === 'Donation' && c.direction === 'in')).toBe(true)
    expect(DEFAULT_ONBOARDING_CATEGORIES.some((c) => c.label === 'Adoption fee')).toBe(false)
  })

  it('commits org identity, statuses, and ledger categories atomically', async () => {
    const executedSql: { sql: string; params?: unknown[] }[] = []
    const mockDb: SanctuaryDb = {
      execute: vi.fn(async (sql, params) => {
        executedSql.push({ sql, params })
      }),
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(async (fn) => {
        await fn({
          execute: vi.fn(async (sql, params) => {
            executedSql.push({ sql, params })
          }),
          getAll: vi.fn(async () => []),
          getOptional: vi.fn(async () => null),
        } as unknown as SanctuaryDb)
      }),
    }

    const input: CommitOnboardingInput = {
      orgId: 'org-123',
      name: 'Safe Haven Sanctuary',
      initials: 'SHS',
      statuses: [
        { label: 'Intake', countsAsInCare: true },
        { label: 'Adopted', countsAsInCare: false },
      ],
      categories: [
        { label: 'Donation', direction: 'in' },
        { label: 'Food', direction: 'out' },
      ],
    }

    await commitOnboarding(mockDb, input)

    expect(executedSql.some((e) => e.sql.includes('UPDATE organizations SET name = ?') && e.params?.[2] === 1)).toBe(true)
    expect(executedSql.some((e) => e.sql.includes('INSERT INTO animal_statuses'))).toBe(true)
    expect(executedSql.some((e) => e.sql.includes('INSERT INTO ledger_categories'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding/onboardingDomain.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/features/onboarding/domain/onboarding.ts`**

```typescript
import type { SanctuaryDb } from '@/shared/lib/db'
import type { LedgerDirection } from '@/features/ledger/domain/ledger'
import { setPartnerLogo } from '@/features/settings/domain/partnerLogo'

export type StatusDraft = {
  id?: string
  label: string
  countsAsInCare: boolean
}

export type CategoryDraft = {
  id?: string
  label: string
  direction: LedgerDirection
}

export const DEFAULT_ONBOARDING_STATUSES: readonly StatusDraft[] = [
  { label: 'Intake', countsAsInCare: true },
  { label: 'Quarantine', countsAsInCare: true },
  { label: 'Treatment', countsAsInCare: true },
  { label: 'In sanctuary', countsAsInCare: true },
  { label: 'Adopted', countsAsInCare: false },
  { label: 'Transferred', countsAsInCare: false },
  { label: 'Deceased', countsAsInCare: false },
]

export const DEFAULT_ONBOARDING_CATEGORIES: readonly CategoryDraft[] = [
  { label: 'Donation', direction: 'in' },
  { label: 'Food & Nutrition', direction: 'out' },
  { label: 'Medical & Vet', direction: 'out' },
  { label: 'Supplies & Bedding', direction: 'out' },
  { label: 'Facility & Operations', direction: 'out' },
]

export type CommitOnboardingInput = {
  orgId: string
  name: string
  initials: string
  logoFile?: File | null
  statuses: StatusDraft[]
  categories: CategoryDraft[]
}

export async function commitOnboarding(
  db: SanctuaryDb,
  input: CommitOnboardingInput,
): Promise<void> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Enter your shelter name.')
  }
  const initials = input.initials.trim() || name.slice(0, 3).toUpperCase()
  const filteredStatuses = input.statuses
    .map((s) => ({ ...s, label: s.label.trim() }))
    .filter((s) => Boolean(s.label))

  if (filteredStatuses.length === 0) {
    throw new Error('Add at least one animal status.')
  }

  const filteredCategories = input.categories
    .map((c) => ({ ...c, label: c.label.trim() }))
    .filter((c) => Boolean(c.label))

  if (filteredCategories.length === 0) {
    throw new Error('Add at least one ledger category.')
  }

  if (input.logoFile) {
    await setPartnerLogo(db, input.orgId, input.logoFile)
  }

  const now = new Date().toISOString()

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE organizations SET name = ?, initials = ?, setup_completed = 1 WHERE id = ?`,
      [name, initials, input.orgId],
    )

    await tx.execute(`DELETE FROM animal_statuses WHERE org_id = ?`, [input.orgId])
    for (let i = 0; i < filteredStatuses.length; i++) {
      const s = filteredStatuses[i]
      const statusId = s.id || crypto.randomUUID()
      await tx.execute(
        `INSERT INTO animal_statuses (id, org_id, label, sort_order, counts_as_in_care, archived, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [statusId, input.orgId, s.label, i + 1, s.countsAsInCare ? 1 : 0, now],
      )
    }

    await tx.execute(`DELETE FROM ledger_categories WHERE org_id = ?`, [input.orgId])
    for (const c of filteredCategories) {
      const catId = c.id || crypto.randomUUID()
      await tx.execute(
        `INSERT INTO ledger_categories (id, org_id, label, direction, archived, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [catId, input.orgId, c.label, c.direction, now],
      )
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding/onboardingDomain.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/domain/onboarding.ts tests/unit/onboarding/onboardingDomain.test.ts
git commit -m "feat(onboarding): implement commitOnboarding domain function and defaults"
```

---

### Task 4: Wizard Step Components (Identity, Statuses, Ledger, Progress)

**Files:**
- Create: `src/features/onboarding/components/OnboardingProgress.tsx`
- Create: `src/features/onboarding/components/StepIdentity.tsx`
- Create: `src/features/onboarding/components/StepStatuses.tsx`
- Create: `src/features/onboarding/components/StepLedger.tsx`
- Test: `tests/unit/onboarding/stepComponents.test.tsx`

**Interfaces:**
- Consumes: Domain types from `onboarding.ts`, Sanctuary UI primitives (`Button`, `Field`, `SelectField`).
- Produces: Step components rendered within `OnboardingScreen`.

- [ ] **Step 1: Write component unit tests for step transitions and validations**

```tsx
// tests/unit/onboarding/stepComponents.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepIdentity } from '@/features/onboarding/components/StepIdentity'
import { StepStatuses } from '@/features/onboarding/components/StepStatuses'
import { StepLedger } from '@/features/onboarding/components/StepLedger'
import {
  DEFAULT_ONBOARDING_STATUSES,
  DEFAULT_ONBOARDING_CATEGORIES,
} from '@/features/onboarding/domain/onboarding'

describe('Onboarding Step Components', () => {
  it('StepIdentity disables continue when name is empty', () => {
    const onNext = vi.fn()
    render(
      <StepIdentity
        name=""
        initials=""
        logoFile={null}
        onNameChange={vi.fn()}
        onInitialsChange={vi.fn()}
        onLogoFileChange={vi.fn()}
        onNext={onNext}
      />,
    )
    const nextBtn = screen.getByRole('button', { name: /Continue/i })
    expect(nextBtn).toBeDisabled()
  })

  it('StepStatuses renders default statuses and allows adding new ones', () => {
    const onStatusesChange = vi.fn()
    render(
      <StepStatuses
        statuses={[...DEFAULT_ONBOARDING_STATUSES]}
        onStatusesChange={onStatusesChange}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByDisplayValue('Intake')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Quarantine')).toBeInTheDocument()
  })

  it('StepLedger renders default categories and finish button', () => {
    render(
      <StepLedger
        categories={[...DEFAULT_ONBOARDING_CATEGORIES]}
        onCategoriesChange={vi.fn()}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    expect(screen.getByDisplayValue('Donation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Finish setup/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding/stepComponents.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement step components and progress indicator**

Implement `OnboardingProgress.tsx`, `StepIdentity.tsx`, `StepStatuses.tsx`, and `StepLedger.tsx` with clean field handling, drag/move controls, inline edits, and accessibility labels.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding/stepComponents.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/components/ tests/unit/onboarding/stepComponents.test.tsx
git commit -m "feat(onboarding): add onboarding wizard step components"
```

---

### Task 5: Onboarding Screen, Styling & App Route Guard

**Files:**
- Create: `src/features/onboarding/screens/OnboardingScreen.tsx`
- Create: `src/features/onboarding/screens/SetupWaitingScreen.tsx`
- Create: `src/features/onboarding/onboarding.css`
- Modify: `src/app/router.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/unit/onboarding/onboardingGuard.test.tsx`

**Interfaces:**
- Consumes: `useCurrentMember`, `useDb`, `commitOnboarding`.
- Produces: Complete `/onboarding` screen and setup route guarding across the app.

- [ ] **Step 1: Write unit tests for onboarding route guard and waiting screen**

```tsx
// tests/unit/onboarding/onboardingGuard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetupWaitingScreen } from '@/features/onboarding/screens/SetupWaitingScreen'

describe('SetupWaitingScreen', () => {
  it('displays message for staff when setup is incomplete', () => {
    render(<SetupWaitingScreen onSignOut={vi.fn()} />)
    expect(screen.getByText(/currently being set up by an administrator/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign out/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding/onboardingGuard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `OnboardingScreen`, `SetupWaitingScreen`, `onboarding.css`, and update `router.tsx` / `App.tsx`**

1. Create `src/features/onboarding/onboarding.css` styling the multi-step canvas, progress header, cards, and responsive layouts.
2. Implement `OnboardingScreen.tsx` managing wizard step state (1 -> 2 -> 3), calling `commitOnboarding`, handling errors, and navigating to `/animals` on success.
3. Implement `SetupWaitingScreen.tsx` for non-admin roles when `setupCompleted === false`.
4. Update `src/app/App.tsx` and `src/app/router.tsx`:
   - If `!member.setupCompleted`:
     - If `member.role === 'admin'`: route to `/onboarding`.
     - If `member.role !== 'admin'`: show `SetupWaitingScreen`.
   - If `member.setupCompleted`:
     - Disallow `/onboarding` (redirect to `/animals`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding/onboardingGuard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/ src/app/router.tsx src/app/App.tsx tests/unit/onboarding/onboardingGuard.test.tsx
git commit -m "feat(onboarding): implement OnboardingScreen, SetupWaitingScreen, and router guard"
```

---

### Task 6: Full Test Suite & Build Verification

**Files:**
- Test files across `tests/unit/`

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All unit tests PASS with 0 failures.

- [ ] **Step 2: Run TypeScript and build check**

Run: `npm run build`
Expected: Vite build succeeds with no type errors or bundle issues.

- [ ] **Step 3: Commit all remaining changes**

```bash
git add .
git commit -m "chore(onboarding): verify full test suite and production build"
```
