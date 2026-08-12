# Multi-Status & Daily Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let animals carry multiple statuses and give shelters an org-shared daily checklist under Overview (with overdue UI and Web Push last).

**Architecture:** Replace single-status reads with `animal_status_assignments` (keep `animals.status_id` as a denormalized primary for NOT NULL / public-page compatibility). Filters move to `/animals/filters` with SQL any/all matching. Checklist uses `checklist_items` + `checklist_checks`; Overview shows a ≤5-row snippet and `/checklist` is the full page — no fifth nav tab. Push subscriptions live server-side; an Edge Function sends evening/morning reminders.

**Tech Stack:** Vite/React PWA, PowerSync SQLite, Supabase Postgres + Edge Functions, Vitest

**Spec:** `docs/superpowers/specs/2026-08-12-multi-status-checklist-design.md`

## Global Constraints

- UI language stays **Status** (multi-select); do not rename to Tags/Labels
- No fifth primary nav item; checklist only via Overview → `/checklist` (and push deep link)
- Filtering must be SQL/PowerSync predicates — never load the full herd then filter in React
- In care = ≥1 in-care status AND zero out-of-care statuses (“exit wins”)
- Exit status assignment is exclusive after confirm; no Undo control
- Checklist is org-shared; merge-only from Animals; remove only on checklist page
- Checkmarks reset by local calendar day; items persist until removed
- Tests only under top-level `tests/` (never under `src/`)
- Prefer soft-delete/archive for animals; English UI; free text accepts Urdu/Unicode
- Brand: primary `#87A96B`, background `#F5F1E8`, text `#3E4C3E`
- Web Push is the last wave; Overview overdue badge must work without push permission

**Execution waves:**  
- **Wave A (Tasks 1–6):** multi-status schema + domain + animal UI + public labels  
- **Wave B (Tasks 7–8):** filters page + list chrome / select mode scaffolding  
- **Wave C (Tasks 9–12):** checklist domain + add flow + Overview + `/checklist`  
- **Wave D (Task 13):** Settings out-of-care reclassify confirm  
- **Wave E (Tasks 14–15):** Web Push  

Each wave should leave `npm test` and `npm run build` green.

---

## File structure (target)

```text
supabase/migrations/
  20260812120000_animal_status_assignments.sql
  20260812130000_checklist.sql
  20260812140000_push_subscriptions.sql
powersync/sync-streams.yaml                    # add new synced tables
src/features/sync/powersync/schema.ts          # assignments + checklist_*
src/features/statuses/domain/
  assignments.ts                               # set/list/replace assignments + primary mirror
src/features/animals/domain/animals.ts         # search/count/create/update via assignments
src/features/animals/components/
  AnimalCard.tsx                               # multi badges (max 2 + +N)
  StatusMultiSelect.tsx                        # chips picker + exit confirm hook-in
src/features/animals/screens/
  AnimalsListScreen.tsx                        # filter icon, Add to checklist, select mode
  AnimalsFiltersScreen.tsx                     # new
  AnimalDetailScreen.tsx / AnimalIntakeScreen.tsx
src/features/checklist/domain/checklist.ts
src/features/checklist/screens/ChecklistScreen.tsx
src/features/checklist/components/OverviewChecklistCard.tsx
src/features/dashboard/screens/DashboardScreen.tsx
src/features/settings/screens/SettingsScreen.tsx
src/features/settings/domain/statusInCare.ts   # reclassify + strip helpers
src/shared/lib/checklist/missedStreak.ts       # pure streak helper
src/shared/lib/animals/filterParams.ts         # URL search param encode/decode
supabase/functions/
  public-shelter/index.ts                      # statusLabels from assignments
  checklist-reminders/index.ts                 # morning/evening web push
  push-subscribe/index.ts                      # upsert subscription
```

**Denormalized primary rule (lock this):** After every assignment write, set `animals.status_id` to: the sole out-of-care assignment if any, else the assigned status with lowest `sort_order` (tie-break by label). App list/detail **display** uses assignment joins (`status_labels`), not only `status_id`.

**Badge overflow:** show at most **2** badges, then `+N`.

**Missed streak:** pure function over local dates (see Task 9) — not fragile SQL in v1.

**Filter URL:** `/animals?status=<id>&status=<id>&statusMode=any|all&species=&sex=&q=` — Filters page reads/writes the same params and navigates back to `/animals?...`.

---

### Task 1: Assignments migration + PowerSync schema

**Files:**
- Create: `supabase/migrations/20260812120000_animal_status_assignments.sql`
- Modify: `src/features/sync/powersync/schema.ts`
- Modify: `powersync/sync-streams.yaml`

**Interfaces:**
- Produces: Postgres + SQLite table `animal_status_assignments`; synced to clients

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260812120000_animal_status_assignments.sql
create table animal_status_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  status_id uuid not null references animal_statuses(id),
  created_at timestamptz not null default now(),
  unique (animal_id, status_id)
);

create index animal_status_assignments_by_org on animal_status_assignments (org_id);
create index animal_status_assignments_by_animal on animal_status_assignments (animal_id);
create index animal_status_assignments_by_status on animal_status_assignments (status_id);

insert into animal_status_assignments (org_id, animal_id, status_id, created_at)
select a.org_id, a.id, a.status_id, coalesce(a.updated_at, a.created_at, now())
from animals a
where a.status_id is not null
on conflict (animal_id, status_id) do nothing;

alter table animal_status_assignments enable row level security;

create policy animal_status_assignments_all on animal_status_assignments for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- Keep animals.status_id NOT NULL as denormalized primary (do not drop).
```

Match RLS style from `001_initial_schema.sql` (same `user_org_ids()` helper).

- [ ] **Step 2: Add PowerSync table**

In `schema.ts`, add:

```ts
const animal_status_assignments = new Table(
  {
    org_id: column.text,
    animal_id: column.text,
    status_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      by_org: ['org_id'],
      by_animal: ['animal_id'],
      by_status: ['status_id'],
    },
  },
)
```

Register it on `AppSchema` and export `AnimalStatusAssignmentRecord`.

- [ ] **Step 3: Sync stream**

Add to `powersync/sync-streams.yaml` under `sanctuary_org_data.queries`:

```yaml
- SELECT * FROM animal_status_assignments WHERE org_id IN user_org_ids
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812120000_animal_status_assignments.sql \
  src/features/sync/powersync/schema.ts powersync/sync-streams.yaml
git commit -m "Add animal_status_assignments schema and sync."
```

---

### Task 2: Assignments domain + primary mirror

**Files:**
- Create: `src/features/statuses/domain/assignments.ts`
- Test: `tests/unit/statuses/assignments.test.ts`

**Interfaces:**
- Produces:
  - `listAssignmentsForAnimal(db, animalId): Promise<{ status_id: string; label: string; sort_order: number; counts_as_in_care: number }[]>`
  - `replaceAnimalStatuses(db, { orgId, animalId, statusIds: string[] }): Promise<void>`  
    — requires `statusIds.length >= 1`; if any selected status has `counts_as_in_care = 0`, keep **only the first out-of-care id in `statusIds`** (caller should already have confirmed); updates `animals.status_id` via primary rule; appends care-log `status` note with sorted labels when the set changes
  - `resolvePrimaryStatusId(statuses: { id: string; sort_order: number; counts_as_in_care: number; label: string }[]): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  resolvePrimaryStatusId,
  replaceAnimalStatuses,
} from '@/features/statuses/domain/assignments'

describe('resolvePrimaryStatusId', () => {
  it('prefers out-of-care over in-care', () => {
    expect(
      resolvePrimaryStatusId([
        { id: 'c', sort_order: 1, counts_as_in_care: 1, label: 'Critical' },
        { id: 'a', sort_order: 9, counts_as_in_care: 0, label: 'Adopted' },
      ]),
    ).toBe('a')
  })

  it('picks lowest sort_order among in-care', () => {
    expect(
      resolvePrimaryStatusId([
        { id: 'b', sort_order: 2, counts_as_in_care: 1, label: 'B' },
        { id: 'a', sort_order: 1, counts_as_in_care: 1, label: 'A' },
      ]),
    ).toBe('a')
  })
})

describe('replaceAnimalStatuses', () => {
  it('rejects empty status set', async () => {
    const db = { writeTransaction: vi.fn(), getAll: vi.fn(), getOptional: vi.fn(), execute: vi.fn() }
    await expect(
      replaceAnimalStatuses(db as never, {
        orgId: 'o',
        animalId: 'a',
        statusIds: [],
      }),
    ).rejects.toThrow(/at least one status/i)
  })

  it('when any out-of-care id present, writes only that exit assignment', async () => {
    const executes: unknown[] = []
    const db = {
      getAll: vi.fn(async (sql: string) => {
        if (sql.includes('FROM animal_statuses')) {
          return [
            { id: 'crit', label: 'Critical', sort_order: 1, counts_as_in_care: 1 },
            { id: 'adopt', label: 'Adopted', sort_order: 9, counts_as_in_care: 0 },
          ]
        }
        if (sql.includes('FROM animal_status_assignments')) {
          return [{ status_id: 'crit' }]
        }
        return []
      }),
      getOptional: vi.fn(async () => ({ org_id: 'o' })),
      writeTransaction: async (fn: (tx: { execute: typeof db.execute }) => Promise<void>) => {
        await fn({ execute: db.execute })
      },
      execute: vi.fn(async (...args: unknown[]) => {
        executes.push(args)
      }),
    }

    await replaceAnimalStatuses(db as never, {
      orgId: 'o',
      animalId: 'a1',
      statusIds: ['crit', 'adopt'],
    })

    const assignmentInserts = executes.filter(
      (e) => String((e as unknown[])[0]).includes('INSERT INTO animal_status_assignments'),
    )
    expect(assignmentInserts.length).toBe(1)
    expect((assignmentInserts[0] as unknown[])[1]).toEqual(
      expect.arrayContaining(['a1', 'adopt']),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/statuses/assignments.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `assignments.ts`**

Implement `resolvePrimaryStatusId` and `replaceAnimalStatuses`:

1. Load status rows for `statusIds`.
2. If any has `counts_as_in_care = 0`, reduce to that single exit id (if multiple exits in input, use the first exit in the provided `statusIds` order).
3. Diff against current assignments; if unchanged, return.
4. In a write transaction: `DELETE FROM animal_status_assignments WHERE animal_id = ?`, insert new rows, `UPDATE animals SET status_id = ?, updated_at = ?`.
5. Call existing `addTreatment` with `treatmentType: 'status'` and notes = labels joined by `, ` ordered by `sort_order`.

Also export `listAssignmentsForAnimal` with a join query ordered by `sort_order`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/unit/statuses/assignments.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/features/statuses/domain/assignments.ts tests/unit/statuses/assignments.test.ts
git commit -m "Add status assignment replace helpers with exit exclusivity."
```

---

### Task 3: Animals domain — search, counts, CRUD via assignments

**Files:**
- Modify: `src/features/animals/domain/animals.ts`
- Modify: `tests/unit/shared/searchAnimals.test.ts`
- Create: `tests/unit/animals/countInCare.test.ts`
- Modify: `src/features/playground/seed.ts` (insert assignments)
- Modify: `src/features/sync/hydrateOrgBootstrap.ts` only if it assumes single status for bootstrap copies — keep animals rows; assignments sync separately

**Interfaces:**
- Change `AnimalSearchFilters`:
  - Remove `statusId?: string`
  - Add `statusIds?: string[]`
  - Add `statusMode?: 'any' | 'all'` (default `'any'`)
- Change `AnimalWithStatus`:
  - Keep `status_id` / `status_label` as primary mirrors for compatibility
  - Add `status_labels: string[]` (ordered)
- Change `CreateAnimalInput` / `UpdateAnimalInput`: `statusIds: string[]` (min 1) instead of single `statusId`
- `updateAnimalStatus` → thin wrapper calling `replaceAnimalStatuses` **or** delete and use `replaceAnimalStatuses` everywhere
- `countInCare` uses exit-wins SQL
- `archiveAnimal` unchanged here (checklist removal in Task 11)

- [ ] **Step 1: Update failing search tests**

Replace status filter expectations:

```ts
it('filters match any selected statuses via assignments', async () => {
  const getAll = vi.fn().mockResolvedValue([])
  const db = { getAll } as never
  await searchAnimals(db, 'org-1', {
    statusIds: ['s1', 's2'],
    statusMode: 'any',
  })
  const [sql, params] = getAll.mock.calls[0]!
  expect(sql).toMatch(/animal_status_assignments/i)
  expect(sql).toMatch(/IN\s*\(/i)
  expect(params).toEqual(expect.arrayContaining(['org-1', 's1', 's2']))
})

it('filters match all selected statuses', async () => {
  const getAll = vi.fn().mockResolvedValue([])
  const db = { getAll } as never
  await searchAnimals(db, 'org-1', {
    statusIds: ['s1', 's2'],
    statusMode: 'all',
  })
  const [sql] = getAll.mock.calls[0]!
  expect(sql).toContain('HAVING')
  expect(sql).toContain('COUNT(DISTINCT')
})
```

- [ ] **Step 2: Write `countInCare` tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { countInCare } from '@/features/animals/domain/animals'

describe('countInCare', () => {
  it('uses exit-wins SQL (in-care assignment and no out-of-care)', async () => {
    const getOptional = vi.fn().mockResolvedValue({ n: 12 })
    const db = { getOptional } as never
    await expect(countInCare(db, 'org-1')).resolves.toBe(12)
    const [sql, params] = getOptional.mock.calls[0]!
    expect(sql).toMatch(/counts_as_in_care\s*=\s*1/i)
    expect(sql).toMatch(/counts_as_in_care\s*=\s*0/i)
    expect(sql).toMatch(/NOT EXISTS|LEFT JOIN/i)
    expect(params).toEqual(['org-1'])
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npm test -- tests/unit/shared/searchAnimals.test.ts tests/unit/animals/countInCare.test.ts`

- [ ] **Step 4: Implement domain changes**

**Match any SQL shape:**

```sql
SELECT a.*, prim.label as status_label
FROM animals a
LEFT JOIN animal_statuses prim ON prim.id = a.status_id
WHERE a.org_id = ? AND a.archived = 0
AND a.id IN (
  SELECT asa.animal_id FROM animal_status_assignments asa
  WHERE asa.status_id IN (?, ?)
)
```

**Match all SQL shape:**

```sql
AND a.id IN (
  SELECT asa.animal_id FROM animal_status_assignments asa
  WHERE asa.status_id IN (?, ?)
  GROUP BY asa.animal_id
  HAVING COUNT(DISTINCT asa.status_id) = ?
)
```

(`?` for having = `statusIds.length`)

**countInCare:**

```sql
SELECT COUNT(*) as n FROM animals a
WHERE a.org_id = ? AND a.archived = 0
AND EXISTS (
  SELECT 1 FROM animal_status_assignments asa
  JOIN animal_statuses s ON s.id = asa.status_id
  WHERE asa.animal_id = a.id AND s.counts_as_in_care = 1
)
AND NOT EXISTS (
  SELECT 1 FROM animal_status_assignments asa
  JOIN animal_statuses s ON s.id = asa.status_id
  WHERE asa.animal_id = a.id AND s.counts_as_in_care = 0
)
```

After `searchAnimals` returns rows, either:
- secondary query for labels per animal, or
- `GROUP_CONCAT` in SQLite:  
  `(SELECT GROUP_CONCAT(s.label, char(31)) FROM ... ORDER BY s.sort_order)` then split — prefer a follow-up `getAll` of assignments for returned ids to keep SQL simple.

`createAnimal` / `updateAnimal`: write animal row with temporary `status_id` = `statusIds[0]`, then `replaceAnimalStatuses`.

Update `countAnimalsByStatus` to count assignment rows (an animal can appear in multiple status buckets).

- [ ] **Step 5: Fix playground seed** to insert into `animal_status_assignments` for each seeded animal.

- [ ] **Step 6: Run tests + build**

Run: `npm test -- tests/unit/shared/searchAnimals.test.ts tests/unit/animals/countInCare.test.ts`  
Run: `npm run build`  
Expected: PASS (fix any call sites broken by `statusId` → `statusIds`)

- [ ] **Step 7: Commit**

```bash
git add src/features/animals/domain/animals.ts tests/unit/shared/searchAnimals.test.ts \
  tests/unit/animals/countInCare.test.ts src/features/playground/seed.ts
git commit -m "Route animal search and in-care counts through status assignments."
```

---

### Task 4: Status multi-select UI + animal screens

**Files:**
- Create: `src/features/animals/components/StatusMultiSelect.tsx`
- Modify: `src/features/animals/components/AnimalCard.tsx`
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx`
- Modify: `src/features/animals/screens/AnimalIntakeScreen.tsx`
- Modify: CSS used by animal cards/badges (existing global/app CSS — extend `.status-badge` row)

**Interfaces:**
- `StatusMultiSelect` props: `{ statuses: AnimalStatus[]; value: string[]; onChange: (ids: string[]) => void; onRequestExit?: (exitId: string, nextIds: string[]) => void }`  
  When user toggles on a status with `counts_as_in_care === 0`, call `onRequestExit` instead of immediately applying multi; parent runs `useConfirm` then sets value to `[exitId]`.

- [ ] **Step 1: Implement `StatusMultiSelect`**

Chip/checkbox list of non-archived statuses. Toggling off the last remaining status is blocked (or ignored). Toggling on out-of-care invokes `onRequestExit`.

- [ ] **Step 2: Wire intake + detail/edit**

- Load `statusIds` from `listAssignmentsForAnimal`.
- Save via `replaceAnimalStatuses` / `updateAnimal({ statusIds })`.
- Exit confirm copy:

```ts
await confirm({
  title: 'Mark as out of care?',
  body: 'All other statuses will be removed from this animal.',
  confirmLabel: 'Continue',
  tone: 'danger',
})
```

- [ ] **Step 3: AnimalCard badges**

```tsx
const labels = animal.status_labels?.length
  ? animal.status_labels
  : animal.status_label
    ? [animal.status_label]
    : []
const shown = labels.slice(0, 2)
const extra = labels.length - shown.length
// render StatusBadge for each shown; if extra > 0, render +{extra}
```

- [ ] **Step 4: Manual smoke in playground** — assign two in-care statuses; assign Adopted and confirm wipe.

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/components/StatusMultiSelect.tsx \
  src/features/animals/components/AnimalCard.tsx \
  src/features/animals/screens/AnimalDetailScreen.tsx \
  src/features/animals/screens/AnimalIntakeScreen.tsx
git commit -m "Add multi-status picker and badges on animal surfaces."
```

---

### Task 5: Public shelter status labels

**Files:**
- Modify: `supabase/functions/public-shelter/index.ts`
- Modify: public DTO types + `PublicShelterScreen.tsx` / `AnimalHighlight.tsx` to accept `statusLabel` as joined string **or** `statusLabels: string[]` displayed as comma-separated (keep field name `statusLabel` as joined labels for minimal UI churn)

- [ ] **Step 1: Query assignments in Edge Function**

For in-care animals, join assignments → labels ordered by `sort_order`, set `statusLabel` to `labels.join(', ')`. In-care filter must use exit-wins (same rule as app), not only `animals.status_id.counts_as_in_care`.

- [ ] **Step 2: Deploy note** — `npm run functions:deploy` (or project script) after migration applied.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/public-shelter/index.ts src/features/public/
git commit -m "Show joined status labels on public shelter pages."
```

---

### Task 6: Wave A verify

- [ ] **Step 1: Run** `npm test` and `npm run build` — both green  
- [ ] **Step 2: Commit any leftover fixes** with message `fix: finish multi-status wave A.`

---

### Task 7: Filter URL helpers + Filters page

**Files:**
- Create: `src/shared/lib/animals/filterParams.ts`
- Test: `tests/unit/shared/filterParams.test.ts`
- Create: `src/features/animals/screens/AnimalsFiltersScreen.tsx`
- Modify: `src/app/router.tsx` — route `/animals/filters`

**Interfaces:**
- `parseAnimalFilterParams(search: string): { query: string; statusIds: string[]; statusMode: 'any' | 'all'; species: string; sex: string }`
- `serializeAnimalFilterParams(filters): string` (leading `?` or raw query string)

- [ ] **Step 1: Failing tests for parse/serialize**

```ts
import { describe, expect, it } from 'vitest'
import {
  parseAnimalFilterParams,
  serializeAnimalFilterParams,
} from '@/shared/lib/animals/filterParams'

describe('animal filter params', () => {
  it('round-trips multi status and mode', () => {
    const q = serializeAnimalFilterParams({
      query: 'til',
      statusIds: ['a', 'b'],
      statusMode: 'all',
      species: 'Cat',
      sex: '',
    })
    expect(parseAnimalFilterParams(q)).toEqual({
      query: 'til',
      statusIds: ['a', 'b'],
      statusMode: 'all',
      species: 'Cat',
      sex: '',
    })
  })

  it('defaults statusMode to any', () => {
    expect(parseAnimalFilterParams('?status=x').statusMode).toBe('any')
  })
})
```

- [ ] **Step 2: Implement helpers + Filters screen**

Filters screen UI:
- Multi-select statuses
- Toggle labeled **Match any selected** / **Match all selected**
- Species + sex controls (same options as today’s list)
- **Apply** → `navigate('/animals' + serialize...)`
- **Clear** → `navigate('/animals')`

- [ ] **Step 3: Router**

```tsx
<Route path="/animals/filters" element={<AnimalsFiltersScreen />} />
```

- [ ] **Step 4: Tests pass + commit**

```bash
git add src/shared/lib/animals/filterParams.ts tests/unit/shared/filterParams.test.ts \
  src/features/animals/screens/AnimalsFiltersScreen.tsx src/app/router.tsx
git commit -m "Add animals filters page with any/all status matching params."
```

---

### Task 8: Animals list chrome — filter icon + Add to checklist select mode shell

**Files:**
- Modify: `src/features/animals/screens/AnimalsListScreen.tsx`
- Modify: list CSS as needed

**Note:** Confirm’s DB write is Task 10 (after checklist domain in Task 9). This task only removes inline `FilterMenu` pills and builds navigation + select-mode UI; Confirm may exit select mode without persisting until Task 10 wires `addAnimalsToChecklist`.

- [ ] **Step 1: Read filters from URL** via `useSearchParams` + `parseAnimalFilterParams`; pass `statusIds` / `statusMode` into `searchAnimals`.

- [ ] **Step 2: Replace FilterMenu row** with:
  - Search input
  - Filter icon button → `/animals/filters` + current params (active class when any filter set)
  - **Add to checklist** button → enters `selectMode`

- [ ] **Step 3: Select mode**
  - `selectedIds: Set<string>`
  - Select all: add **all ids from current `animals` result array** (already SQL-filtered). Do not query an unfiltered herd.
  - Card tap toggles selection (stop navigation while selecting — render selectable card button wrapper or `preventDefault` on Link)
  - Confirm / Cancel bar: Confirm disabled when `selectedIds.size === 0`

- [ ] **Step 4: Commit UI shell**

```bash
git add src/features/animals/screens/AnimalsListScreen.tsx
git commit -m "Move animal filters behind icon and add checklist select mode UI."
```

---

### Task 9: Checklist schema + domain + missed streak

**Files:**
- Create: `supabase/migrations/20260812130000_checklist.sql`
- Modify: `schema.ts`, `sync-streams.yaml`
- Create: `src/shared/lib/checklist/missedStreak.ts`
- Create: `src/features/checklist/domain/checklist.ts`
- Test: `tests/unit/checklist/missedStreak.test.ts`
- Test: `tests/unit/checklist/checklistDomain.test.ts`

**Interfaces:**
- `localDateString(d?: Date): string` → `YYYY-MM-DD` device local
- `missedDayStreak({ addedAtIso, checkDates: string[], today: string }): number`  
  — count consecutive days ending **yesterday** with no check, not counting days before `addedAt`’s local date
- `addAnimalsToChecklist(db, { orgId, animalIds, addedBy?: string }): Promise<{ added: number; skipped: number }>`
- `removeFromChecklist(db, { orgId, animalId }): Promise<void>`
- `setChecklistChecked(db, { orgId, animalId, checked: boolean, today?: string, checkedBy?: string }): Promise<void>`
- `listChecklist(db, orgId, today?: string): Promise<ChecklistRow[]>`  
  `ChecklistRow`: animal fields + `checkedToday: boolean` + `missedDays: number`
- `countChecklistOverdue(rows | db): number` — `missedDays >= 1`
- `removeChecklistItemForAnimal(db, animalId)` — used by archive

- [ ] **Step 1: Migration**

```sql
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id),
  unique (org_id, animal_id)
);

create table checklist_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  check_date date not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id),
  unique (org_id, animal_id, check_date)
);

-- RLS policies mirroring other org tables
```

- [ ] **Step 2: Failing streak tests**

```ts
import { describe, expect, it } from 'vitest'
import { missedDayStreak } from '@/shared/lib/checklist/missedStreak'

describe('missedDayStreak', () => {
  it('is 0 when checked yesterday', () => {
    expect(
      missedDayStreak({
        addedAtIso: '2026-08-01T10:00:00.000Z',
        checkDates: ['2026-08-11'],
        today: '2026-08-12',
      }),
    ).toBe(0)
  })

  it('counts consecutive misses ending yesterday', () => {
    expect(
      missedDayStreak({
        addedAtIso: '2026-08-01T10:00:00.000Z',
        checkDates: ['2026-08-09'],
        today: '2026-08-12',
      }),
    ).toBe(2) // 10 and 11 missed
  })

  it('does not count days before added_at local date', () => {
    expect(
      missedDayStreak({
        addedAtIso: '2026-08-11T15:00:00.000Z',
        checkDates: [],
        today: '2026-08-12',
      }),
    ).toBe(0) // added yesterday local depending on TZ — implement using local date of addedAtIso; if added yesterday and unchecked yesterday, streak 1
  })
})
```

Implement using local date parts consistently; adjust the third example to assert the documented rule once the helper exists (added on `today` → streak 0; added yesterday unchecked → 1).

- [ ] **Step 3: Domain merge test**

```ts
it('addAnimalsToChecklist skips duplicates', async () => {
  const execute = vi.fn()
  const getAll = vi.fn()
    .mockResolvedValueOnce([{ animal_id: 'a1' }]) // existing
  // ... assert execute called once for a2 only
})
```

- [ ] **Step 4: Implement + PowerSync tables + sync stream entries**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260812130000_checklist.sql \
  src/features/sync/powersync/schema.ts powersync/sync-streams.yaml \
  src/shared/lib/checklist/missedStreak.ts src/features/checklist/domain/checklist.ts \
  tests/unit/checklist/
git commit -m "Add checklist tables and domain with missed-day streak."
```

---

### Task 10: Wire Add to checklist + archive cleanup

**Files:**
- Modify: `AnimalsListScreen.tsx` Confirm handler → `addAnimalsToChecklist`
- Modify: `archiveAnimal` in `animals.ts` to also delete checklist item
- Test: extend archive unit test or checklist domain test

- [ ] **Step 1: On Confirm**

```ts
const { added, skipped } = await addAnimalsToChecklist(db, {
  orgId: member.orgId,
  animalIds: [...selectedIds],
  addedBy: member.userId,
})
// toast: `Added ${added}` + optional skipped
// exit select mode
```

- [ ] **Step 2: `archiveAnimal`** also `DELETE FROM checklist_items WHERE animal_id = ?`

- [ ] **Step 3: Commit**

```bash
git add src/features/animals/screens/AnimalsListScreen.tsx \
  src/features/animals/domain/animals.ts tests/
git commit -m "Merge selected animals into org checklist; clear on archive."
```

---

### Task 11: Checklist full page

**Files:**
- Create: `src/features/checklist/screens/ChecklistScreen.tsx`
- Modify: `src/app/router.tsx` — `/checklist`
- Empty state → link to `/animals`

- [ ] **Step 1: Screen behavior**
  - List rows from `listChecklist`
  - Checkbox toggles `setChecklistChecked`
  - Show “N days missed” when `missedDays >= 1`
  - Remove control → `removeFromChecklist`
  - Sort: overdue/unchecked first, then name/code

- [ ] **Step 2: Commit**

```bash
git add src/features/checklist/screens/ChecklistScreen.tsx src/app/router.tsx
git commit -m "Add full checklist page under /checklist."
```

---

### Task 12: Overview checklist card

**Files:**
- Create: `src/features/checklist/components/OverviewChecklistCard.tsx`
- Modify: `src/features/dashboard/screens/DashboardScreen.tsx`

- [ ] **Step 1: Card**
  - Load checklist rows
  - Overdue badge = count where `missedDays >= 1`
  - Show up to **5** rows (overdue/unchecked first)
  - **View all** → `/checklist`
  - Place below existing headcount / money snapshot without crowding the first composition more than necessary — follow existing Dashboard stacking

- [ ] **Step 2: Commit**

```bash
git add src/features/checklist/components/OverviewChecklistCard.tsx \
  src/features/dashboard/screens/DashboardScreen.tsx
git commit -m "Show compact checklist and overdue count on Overview."
```

---

### Task 13: Settings — out-of-care reclassify confirm

**Files:**
- Create: `src/features/settings/domain/statusInCare.ts`
- Modify: `SettingsScreen.tsx` / `SortableStatusList` `onInCareChange`
- Test: `tests/unit/settings/statusInCare.test.ts`

**Interfaces:**
- `countAnimalsWithStatusAndOthers(db, statusId): Promise<number>`
- `setStatusOutOfCareWithStrip(db, { statusId, stripOthers: boolean }): Promise<void>`  
  — if `stripOthers`, for each animal that has this status and others: `replaceAnimalStatuses` with `[statusId]` only; then `setStatusInCare(..., false)`. If not stripping path unused — UI only calls strip path after confirm.
- Preferred single API:

```ts
async function applyCountsAsInCareChange(
  db,
  { statusId, countsAsInCare }: { statusId: string; countsAsInCare: boolean },
): Promise<'ok' | 'needs_strip_confirm'>
```

Flow in Settings:
1. User sets In care → Not in care.
2. If `countAnimalsWithStatusAndOthers > 0`, `confirm({ title, body: 'N animals also have other statuses. Save as out of care and remove those other statuses?', ...})`.
3. Cancel → **revert UI state** (do not call DB); abort.
4. Confirm → set flag false + strip others via `replaceAnimalStatuses([statusId])` per animal.
5. If count is 0 → just `setStatusInCare(false)`.

Turning **on** → `setStatusInCare(true)` only.

- [ ] **Step 1: Tests for count + strip**

- [ ] **Step 2: Implement + wire Settings `onInCareChange`**

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/domain/statusInCare.ts \
  src/features/settings/screens/SettingsScreen.tsx \
  tests/unit/settings/statusInCare.test.ts
git commit -m "Confirm before marking a status out of care when animals have extras."
```

---

### Task 14: Push subscribe API + table

**Files:**
- Create: `supabase/migrations/20260812140000_push_subscriptions.sql`
- Create: `supabase/functions/push-subscribe/index.ts`
- Create: `src/features/checklist/domain/pushSubscribe.ts` (client helper calling Edge Function)

**Schema:**

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
-- RLS: users manage own rows; service role for sender
```

**Do not** add to PowerSync (server-only).

- [ ] **Step 1: Edge Function** validates JWT, membership, upserts subscription JSON.

- [ ] **Step 2: Client** `enableChecklistPush()`:
  - Register service worker (use existing Vite PWA SW if present; else add minimal SW)
  - `Notification.requestPermission()`
  - `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })`
  - POST to `push-subscribe`

- [ ] **Step 3: UI entry** on Checklist page and Overview card: **Enable reminders** when permission is `default`; if `denied`, show muted “Notifications blocked in browser settings.”

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812140000_push_subscriptions.sql \
  supabase/functions/push-subscribe/index.ts \
  src/features/checklist/domain/pushSubscribe.ts \
  src/features/checklist/screens/ChecklistScreen.tsx \
  src/features/checklist/components/OverviewChecklistCard.tsx
git commit -m "Add Web Push subscription capture for checklist reminders."
```

---

### Task 15: Checklist reminders sender (evening + morning)

**Files:**
- Create: `supabase/functions/checklist-reminders/index.ts`
- Document cron: evening **18:00** and morning **08:00** in org/device-local pilot — for v1 use **UTC 13:00 and 03:00** as stand-ins **or** pass `slot=evening|morning` query and schedule two Supabase cron jobs; include timezone note in function README comment (pilot: Pakistan UTC+5 → evening 13:00 UTC, morning 03:00 UTC).
- Test: `tests/unit/checklist/reminderCopy.test.ts` for pure message builders

**Logic:**
1. Auth via cron secret header (`CHECKLIST_CRON_SECRET`).
2. For each org with checklist items:
   - `evening`: animals on list with **no** check for **today** (date in `Asia/Karachi` for pilot, constant `PILOT_TZ = 'Asia/Karachi'`).
   - `morning`: animals with `missedDayStreak >= 1` (reuse same date rules).
3. Load push subscriptions for org members; send Web Push with title/body and `data.url = '/checklist'`.
4. Fail soft per subscription; never throw away the whole org batch on one failure.

**Service worker:** `notificationclick` → focus/open `/checklist`.

- [ ] **Step 1: Pure copy helpers + tests**

```ts
export function eveningReminderBody(uncheckedCount: number): string {
  return uncheckedCount === 1
    ? '1 animal on today’s checklist is still unchecked.'
    : `${uncheckedCount} animals on today’s checklist are still unchecked.`
}
```

- [ ] **Step 2: Implement Edge Function + SW click handler**

- [ ] **Step 3: Manual checklist** (not CI): enable permission on a device, trigger function with `slot=evening`, confirm notification opens checklist.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/checklist-reminders/index.ts \
  tests/unit/checklist/reminderCopy.test.ts public/ /* sw changes */
git commit -m "Send morning and evening checklist Web Push reminders."
```

---

## Spec coverage checklist (self-review)

| Spec requirement | Task(s) |
|------------------|---------|
| Many-to-many statuses + migrate | 1–3 |
| Keep “Status” wording | 4 (UI) |
| Exit confirm exclusive | 2, 4 |
| In-care exit-wins | 3 |
| Filters page + any/all + SQL | 7–8 |
| Add to checklist select mode merge | 8, 10 |
| Overview ≤5 + overdue + `/checklist` | 11–12 |
| Daily renew checks; persist items | 9 |
| Missed streak UI | 9, 11–12 |
| Archive removes checklist item | 10 |
| Settings out-of-care confirm strip | 13 |
| Web Push evening + morning | 14–15 |
| No fifth nav | 11–12 routing only |
| Public labels | 5 |
| Keep `status_id` denormalized (not drop) | 1–2 |

**Placeholder scan:** None intentional; push cron timezone locked to pilot `Asia/Karachi` with documented UTC cron times.

**Type consistency:** `statusIds` + `statusMode` on search; `replaceAnimalStatuses`; checklist helpers named as in Tasks 9–10.
