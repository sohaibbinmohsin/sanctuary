# Sanctuary MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an offline-first PWA so Tales of Second Chances (Madiha) can manage animal records, treatments, ledger, photos, and a donor-ready dashboard on unreliable connectivity.

**Architecture:** Vite + React PWA writes to local SQLite via PowerSync; syncs to one multi-tenant Supabase Postgres project with RLS; animal photos stored in Cloudflare R2 with metadata in Postgres; UI always reads local data.

**Tech Stack:** Vite, React 19, TypeScript, `@powersync/web` + `@powersync/react`, `@supabase/supabase-js`, Cloudflare R2 (S3 API), Vitest, React Router, vite-plugin-pwa, html-to-image (dashboard export), JSZip

**Spec:** `docs/superpowers/specs/2026-08-05-sanctuary-mvp-design.md`

## Global Constraints

- Offline-first: UI reads/writes local SQLite only; sync is background
- Brand: primary `#87A96B`, background `#F5F1E8`, text `#3E4C3E`
- English UI; free-text fields must accept Urdu/any Unicode
- Shelter ID: `{ORG_INITIALS}-####` where initials = first letter of each word (e.g. Tales of Second Chances → `TOSC-0042`)
- Support copy when cloud unreachable: `Can't reach Sanctuary cloud right now. Your data is safe on this phone. Please contact support.`
- Support email: `support@themohsinproject.org`
- Data export: CSV + ZIP of images
- Supabase Free for now; do not assume Pro
- No public pages; no social APIs; no Next.js
- Roles in schema from day one (`admin` | `staff` | `volunteer`); pilot seeds one admin
- Prefer soft-delete/archive over hard delete
- Morale: soft toasts on major saves + occasional dashboard greeting; mute-able later

---

## File structure (target)

```text
sanctuary/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  .env.example
  public/
    manifest.webmanifest
    icons/
  supabase/
    migrations/
      001_initial_schema.sql
    seed.sql
  powersync/
    sync-rules.yaml
  src/
    main.tsx
    App.tsx
    styles/
      tokens.css
      global.css
    lib/
      supabase.ts
      powersync/
        database.ts
        connector.ts
        schema.ts
      r2/
        upload.ts
      ids/
        orgInitials.ts
        shelterId.ts
      export/
        csv.ts
        zipImages.ts
      share/
        dashboardImage.ts
      morale/
        messages.ts
    hooks/
      useSyncStatus.ts
      useCurrentMember.ts
    components/
      SyncBanner.tsx
      MoraleToast.tsx
      AnimalCard.tsx
      PhotoCapture.tsx
      StatusBadge.tsx
    screens/
      LoginScreen.tsx
      AnimalsListScreen.tsx
      AnimalDetailScreen.tsx
      AnimalIntakeScreen.tsx
      LedgerScreen.tsx
      DashboardScreen.tsx
      SettingsScreen.tsx
    domain/
      animals.ts
      treatments.ts
      ledger.ts
      statuses.ts
      photos.ts
  src/test/
    setup.ts
    orgInitials.test.ts
    shelterId.test.ts
    csv.test.ts
```

---

### Task 1: Scaffold Vite React PWA + design tokens

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `src/styles/global.css`, `public/manifest.webmanifest`, `.env.example`, `README.md`
- Test: `src/test/setup.ts` (Vitest smoke)

**Interfaces:**
- Produces: runnable `npm run dev` / `npm test`; CSS variables `--color-primary`, `--color-bg`, `--color-text`

- [ ] **Step 1: Scaffold the app**

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @vitest/browser jsdom @testing-library/react @testing-library/jest-dom vite-plugin-pwa
```

If the directory is not empty, create files manually matching Vite React-TS template instead of `create vite`.

- [ ] **Step 2: Configure Vitest + PWA in `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sanctuary',
        short_name: 'Sanctuary',
        theme_color: '#87A96B',
        background_color: '#F5F1E8',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Add design tokens**

```css
/* src/styles/tokens.css */
:root {
  --color-primary: #87A96B;
  --color-bg: #F5F1E8;
  --color-text: #3E4C3E;
  --color-danger: #A65D4E;
  --font-sans: "Source Sans 3", "Segoe UI", sans-serif;
  --font-display: "Fraunces", Georgia, serif;
}
```

```css
/* src/styles/global.css */
@import "./tokens.css";

html, body, #root {
  margin: 0;
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}

button.primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
```

- [ ] **Step 4: `.env.example`**

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_POWERSYNC_URL=
VITE_R2_PUBLIC_BASE_URL=
VITE_SUPPORT_EMAIL=support@themohsinproject.org
```

- [ ] **Step 5: Smoke test + commit**

```bash
npm test -- --run
npm run build
git add -A
git commit -m "chore: scaffold Sanctuary Vite React PWA with sage tokens"
```

Do not commit `.env` or `.cursor/`.

---

### Task 2: Org initials + shelter ID helpers (TDD)

**Files:**
- Create: `src/lib/ids/orgInitials.ts`, `src/lib/ids/shelterId.ts`
- Test: `src/test/orgInitials.test.ts`, `src/test/shelterId.test.ts`

**Interfaces:**
- Produces:
  - `orgInitials(orgName: string): string`
  - `formatShelterId(prefix: string, sequence: number): string` → `TOSC-0042`
  - `nextShelterId(prefix: string, existingCodes: string[]): string`

- [ ] **Step 1: Write failing tests**

```ts
// src/test/orgInitials.test.ts
import { describe, it, expect } from 'vitest'
import { orgInitials } from '../lib/ids/orgInitials'

describe('orgInitials', () => {
  it('takes first letter of each word', () => {
    expect(orgInitials('Tales of Second Chances')).toBe('TOSC')
  })
  it('uppercases and ignores extra spaces', () => {
    expect(orgInitials('  happy   paws  rescue ')).toBe('HPR')
  })
})
```

```ts
// src/test/shelterId.test.ts
import { describe, it, expect } from 'vitest'
import { formatShelterId, nextShelterId } from '../lib/ids/shelterId'

describe('shelterId', () => {
  it('zero-pads to 4 digits', () => {
    expect(formatShelterId('TOSC', 42)).toBe('TOSC-0042')
  })
  it('allocates next sequence from existing codes', () => {
    expect(nextShelterId('TOSC', ['TOSC-0001', 'TOSC-0003'])).toBe('TOSC-0004')
  })
  it('starts at 0001 when empty', () => {
    expect(nextShelterId('TOSC', [])).toBe('TOSC-0001')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run src/test/orgInitials.test.ts src/test/shelterId.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/ids/orgInitials.ts
export function orgInitials(orgName: string): string {
  return orgName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
```

```ts
// src/lib/ids/shelterId.ts
export function formatShelterId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`
}

export function nextShelterId(prefix: string, existingCodes: string[]): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i')
  let max = 0
  for (const code of existingCodes) {
    const m = code.match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return formatShelterId(prefix, max + 1)
}
```

- [ ] **Step 4: Run tests — expect PASS, then commit**

```bash
npm test -- --run src/test/orgInitials.test.ts src/test/shelterId.test.ts
git add src/lib/ids src/test
git commit -m "feat: add org initials and shelter ID allocation"
```

---

### Task 3: Supabase schema, RLS, and seed

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`, `supabase/seed.sql`

**Interfaces:**
- Produces: tables `organizations`, `org_members`, `animal_statuses`, `animals`, `treatments`, `ledger_categories`, `ledger_entries`, `photos` with `org_id` + RLS

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/001_initial_schema.sql
create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  created_at timestamptz not null default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff', 'volunteer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table animal_statuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  sort_order int not null,
  counts_as_in_care boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table animals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  shelter_code text not null,
  name text,
  species text not null,
  sex text,
  markings text,
  intake_date date not null default (current_date),
  status_id uuid not null references animal_statuses(id),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, shelter_code)
);

create table treatments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  treated_at timestamptz not null default now(),
  treatment_type text not null check (treatment_type in ('meds', 'vet', 'procedure', 'other')),
  notes text,
  ledger_entry_id uuid,
  created_at timestamptz not null default now()
);

create table ledger_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  direction text not null check (direction in ('in', 'out')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  category_id uuid not null references ledger_categories(id),
  direction text not null check (direction in ('in', 'out')),
  amount_cents bigint not null check (amount_cents > 0),
  entry_date date not null default (current_date),
  notes text,
  animal_id uuid references animals(id),
  created_at timestamptz not null default now()
);

alter table treatments
  add constraint treatments_ledger_entry_id_fkey
  foreign key (ledger_entry_id) references ledger_entries(id);

create table photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  r2_key text,
  local_only boolean not null default true,
  upload_state text not null default 'pending'
    check (upload_state in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

-- Helper: current user's org ids
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from org_members where user_id = auth.uid();
$$;

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table animal_statuses enable row level security;
alter table animals enable row level security;
alter table treatments enable row level security;
alter table ledger_categories enable row level security;
alter table ledger_entries enable row level security;
alter table photos enable row level security;

create policy org_select on organizations for select
  using (id in (select public.user_org_ids()));

create policy members_select on org_members for select
  using (org_id in (select public.user_org_ids()));

create policy statuses_all on animal_statuses for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy animals_all on animals for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy treatments_all on treatments for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy ledger_categories_all on ledger_categories for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy ledger_entries_all on ledger_entries for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy photos_all on photos for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- PowerSync publication (adjust per PowerSync Supabase guide if names differ)
create publication powersync for table
  organizations, org_members, animal_statuses, animals,
  treatments, ledger_categories, ledger_entries, photos;
```

- [ ] **Step 2: Seed TOSC starter data (run after creating Madiha's auth user)**

```sql
-- supabase/seed.sql
-- Replace :user_id with auth.users id after signup

insert into organizations (id, name, initials)
values ('11111111-1111-1111-1111-111111111111', 'Tales of Second Chances', 'TOSC');

insert into org_members (org_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', :user_id, 'admin');

insert into animal_statuses (org_id, label, sort_order, counts_as_in_care) values
  ('11111111-1111-1111-1111-111111111111', 'Intake', 1, true),
  ('11111111-1111-1111-1111-111111111111', 'Quarantine', 2, true),
  ('11111111-1111-1111-1111-111111111111', 'Treatment', 3, true),
  ('11111111-1111-1111-1111-111111111111', 'In sanctuary', 4, true),
  ('11111111-1111-1111-1111-111111111111', 'Transferred', 5, false),
  ('11111111-1111-1111-1111-111111111111', 'Deceased', 6, false),
  ('11111111-1111-1111-1111-111111111111', 'Adopted', 7, false);

insert into ledger_categories (org_id, label, direction) values
  ('11111111-1111-1111-1111-111111111111', 'Donation', 'in'),
  ('11111111-1111-1111-1111-111111111111', 'Medical', 'out'),
  ('11111111-1111-1111-1111-111111111111', 'Food', 'out'),
  ('11111111-1111-1111-1111-111111111111', 'Supplies', 'out');
```

- [ ] **Step 3: Apply in Supabase SQL editor (Free project), document in README, commit**

```bash
git add supabase
git commit -m "feat: add multi-tenant schema, RLS, and TOSC seed"
```

---

### Task 4: PowerSync schema, connector, and sync rules

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/powersync/schema.ts`, `src/lib/powersync/database.ts`, `src/lib/powersync/connector.ts`, `powersync/sync-rules.yaml`

**Interfaces:**
- Produces: `getPowerSyncDb(): AbstractPowerSyncDatabase`, `SupabaseConnector` implementing PowerSync backend connector upload/download auth

- [ ] **Step 1: Install deps**

```bash
npm install @supabase/supabase-js @powersync/web @powersync/react @journeyapps/wa-sqlite
```

- [ ] **Step 2: Client schema mirroring Postgres tables used offline**

Define `AppSchema` in `src/lib/powersync/schema.ts` with tables: `organizations`, `org_members`, `animal_statuses`, `animals`, `treatments`, `ledger_categories`, `ledger_entries`, `photos` — column types matching migration (text/integer). Follow [PowerSync JS web schema docs](https://docs.powersync.com/client-sdks/reference/javascript-web).

- [ ] **Step 3: Sync rules (org-scoped via membership)**

```yaml
# powersync/sync-rules.yaml
bucket_definitions:
  by_user_org:
    parameters: |
      SELECT org_id FROM org_members WHERE user_id = request.user_id()
    data:
      - SELECT * FROM organizations WHERE id = bucket.org_id
      - SELECT * FROM org_members WHERE org_id = bucket.org_id
      - SELECT * FROM animal_statuses WHERE org_id = bucket.org_id
      - SELECT * FROM animals WHERE org_id = bucket.org_id
      - SELECT * FROM treatments WHERE org_id = bucket.org_id
      - SELECT * FROM ledger_categories WHERE org_id = bucket.org_id
      - SELECT * FROM ledger_entries WHERE org_id = bucket.org_id
      - SELECT * FROM photos WHERE org_id = bucket.org_id
```

If the PowerSync project uses Sync Streams (edition 3) instead of legacy rules, translate the same filters per current PowerSync Supabase guide — same org_id membership constraint.

- [ ] **Step 4: Connector uploads local CRUD via Supabase client**

Implement `SupabaseConnector` with `fetchCredentials` returning Supabase JWT + PowerSync URL, and `uploadData` applying PUT/PATCH/DELETE operations to Supabase REST for each table. Use the community pattern from `powersync-community/vite-react-ts-powersync-supabase`.

- [ ] **Step 5: Wire `PowerSyncContext` in `App.tsx` after login; commit**

```bash
git add src/lib/powersync src/lib/supabase.ts powersync
git commit -m "feat: wire PowerSync schema, connector, and org sync rules"
```

---

### Task 5: Auth + sync banner + support message

**Files:**
- Create: `src/screens/LoginScreen.tsx`, `src/components/SyncBanner.tsx`, `src/hooks/useSyncStatus.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: email/password login; `SyncBanner` showing offline / pending / failed with exact support copy

- [ ] **Step 1: `useSyncStatus`**

Map PowerSync status to `'synced' | 'pending' | 'offline' | 'failed'`.

- [ ] **Step 2: `SyncBanner` failed state must render exactly:**

`Can't reach Sanctuary cloud right now. Your data is safe on this phone. Please contact support.`

Include `mailto:support@themohsinproject.org` (or `import.meta.env.VITE_SUPPORT_EMAIL`).

- [ ] **Step 3: Login screen calls `supabase.auth.signInWithPassword`; on success connect PowerSync**

- [ ] **Step 4: Manual check — airplane mode still shows Animals route shell; banner shows offline; commit**

```bash
git commit -m "feat: add login and sync status banner with support CTA"
```

---

### Task 6: Statuses domain + settings editor

**Files:**
- Create: `src/domain/statuses.ts`, `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Produces:
  - `listStatuses(db, orgId)`
  - `createStatus(db, input)`
  - `renameStatus(db, id, label)`
  - `reorderStatuses(db, orderedIds)`
  - `archiveStatus(db, id)`
- Consumes: PowerSync db execute/write

- [ ] **Step 1: Domain writes insert/update into local `animal_statuses` with UUID primary keys (`crypto.randomUUID()`)**

- [ ] **Step 2: Settings UI — list statuses, add, rename, reorder (up/down), archive — English labels only**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: org status editor (add, rename, reorder, archive)"
```

---

### Task 7: Animals list, intake, detail

**Files:**
- Create: `src/domain/animals.ts`, `src/screens/AnimalsListScreen.tsx`, `src/screens/AnimalIntakeScreen.tsx`, `src/screens/AnimalDetailScreen.tsx`, `src/components/AnimalCard.tsx`, `src/components/StatusBadge.tsx`
- Create: `src/lib/morale/messages.ts`, `src/components/MoraleToast.tsx`

**Interfaces:**
- Produces:
  - `createAnimal(db, { orgId, prefix, species, name?, markings?, sex?, statusId, notes?, intakeDate? })` → assigns `nextShelterId`
  - `searchAnimals(db, orgId, { query, statusId, species })`
- Morale toast on successful intake from `messages.ts`

- [ ] **Step 1: Unit-test `createAnimal` shelter code allocation against mocked existing codes (pure helper already tested; integration via domain using `nextShelterId`)**

- [ ] **Step 2: Intake form fields**

Required: species, status (default first non-archived by sort_order).  
Optional: name, sex, markings, notes.  
Intake date defaults today.  
Shelter code read-only preview after save.  
Photo: defer to Task 8 but show placeholder CTA.

- [ ] **Step 3: List — search by shelter_code and name; filter status/species; card grid with photo slot**

- [ ] **Step 4: Detail — show fields, status change, link to treatments (Task 9)**

- [ ] **Step 5: After save, show morale toast (e.g. from `INTAKE_MESSAGES` array, pick random). Commit**

```bash
git commit -m "feat: animal intake, list search/filter, and detail"
```

---

### Task 8: Photo capture, local queue, R2 upload

**Files:**
- Create: `src/domain/photos.ts`, `src/components/PhotoCapture.tsx`, `src/lib/r2/upload.ts`
- Create: Supabase Edge Function `supabase/functions/r2-sign/index.ts` (signed PUT URL)

**Interfaces:**
- Produces:
  - `queuePhoto(db, { orgId, animalId, blob })` — compress, store in IndexedDB/Cache API, insert `photos` row `upload_state='pending'`
  - `processPhotoQueue(db)` — for each pending, get signed URL, PUT to R2, set `r2_key`, `upload_state='uploaded'`
- Edge function: `POST { key }` → `{ uploadUrl, publicUrl }` authenticated with Supabase JWT

- [ ] **Step 1: On-device compress** — canvas resize longest edge 1600px, JPEG/WebP quality ~0.7

- [ ] **Step 2: Edge function uses Cloudflare R2 credentials from function secrets (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_BASE_URL`); verify JWT org membership before signing

- [ ] **Step 3: `PhotoCapture` — camera/file input; works offline (queues); show “N photos waiting” from pending count

- [ ] **Step 4: On sync/reconnect + interval, call `processPhotoQueue`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: offline photo queue with R2 signed uploads"
```

---

### Task 9: Treatments log

**Files:**
- Create: `src/domain/treatments.ts`
- Modify: `src/screens/AnimalDetailScreen.tsx`

**Interfaces:**
- Produces: `addTreatment(db, { orgId, animalId, treatmentType, notes, treatedAt?, ledgerEntryId? })` append-only insert

- [ ] **Step 1: UI on animal detail — list treatments newest first; form: type select, notes (Unicode), date, optional ledger link later**

- [ ] **Step 2: Morale toast on save**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: append-only treatments log on animals"
```

---

### Task 10: Ledger

**Files:**
- Create: `src/domain/ledger.ts`, `src/screens/LedgerScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx` (category editor)

**Interfaces:**
- Produces:
  - `addLedgerEntry(db, { orgId, categoryId, direction, amountCents, entryDate, notes?, animalId? })`
  - `sumLedger(db, orgId, { from?, to? })` → `{ inCents, outCents }`

- [ ] **Step 1: Amount entered in major units (PKR) — convert to integer cents/paisa (`Math.round(amount * 100)`) for storage; display formatted**

- [ ] **Step 2: Optional animal picker (search by shelter code/name)**

- [ ] **Step 3: Category settings — add/rename/archive like statuses**

- [ ] **Step 4: Morale toast on save; commit**

```bash
git commit -m "feat: org ledger with optional animal link and categories"
```

---

### Task 11: Dashboard + morale greeting + share image

**Files:**
- Create: `src/screens/DashboardScreen.tsx`, `src/lib/share/dashboardImage.ts`
- Modify: `src/lib/morale/messages.ts`

**Interfaces:**
- Produces:
  - Headcount = count animals where status.`counts_as_in_care` and not archived
  - Money snapshot = month in/out from `sumLedger`
  - `renderDashboardImage(element: HTMLElement): Promise<Blob>` via `html-to-image`
  - Branding: partner org name primary; small “Powered by Sanctuary”

- [ ] **Step 1: Install `npm install html-to-image`**

- [ ] **Step 2: Dashboard greeting — pick from `DASHBOARD_GREETINGS` occasionally (e.g. once per app session)**

- [ ] **Step 3: Buttons — Copy summary text; Download PNG; Web Share API when available**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: dashboard headcount, money snapshot, and share image"
```

---

### Task 12: Data export CSV + images ZIP

**Files:**
- Create: `src/lib/export/csv.ts`, `src/lib/export/zipImages.ts`
- Modify: `src/screens/SettingsScreen.tsx`
- Test: `src/test/csv.test.ts`

**Interfaces:**
- Produces:
  - `animalsToCsv(rows): string`
  - `treatmentsToCsv(rows): string`
  - `ledgerToCsv(rows): string`
  - `buildExportZip({ csvFiles, images: { name, blob }[] }): Promise<Blob>` using JSZip

- [ ] **Step 1: Failing CSV tests for header row + escaping commas/quotes/Urdu text**

```ts
import { animalsToCsv } from '../lib/export/csv'
import { describe, it, expect } from 'vitest'

it('escapes quotes and keeps Urdu', () => {
  const csv = animalsToCsv([
    { shelter_code: 'TOSC-0001', name: 'بلا', species: 'cat', markings: 'a, b', status: 'Intake' },
  ])
  expect(csv).toContain('بلا')
  expect(csv).toContain('"a, b"')
})
```

- [ ] **Step 2: Implement CSV helpers + ZIP (`npm install jszip`); include uploaded images fetched from R2 or local cache when present; skip missing with log**

- [ ] **Step 3: Settings → “Export my data” downloads `sanctuary-export-YYYY-MM-DD.zip` containing `animals.csv`, `treatments.csv`, `ledger.csv`, `images/`**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: MOU data export as CSV plus images ZIP"
```

---

### Task 13: Pilot hardening checklist

**Files:**
- Modify: `README.md` with pilot runbook

- [ ] **Step 1: Document env setup — Supabase Free project, PowerSync instance, R2 bucket CORS, seed user**

- [ ] **Step 2: Manual gate on Android Chrome**

1. Install PWA  
2. Airplane mode: intake animal + photo + expense + treatment with Urdu notes  
3. Reconnect: rows in Supabase; photo in R2; banner returns to synced  
4. Dashboard image share to WhatsApp  
5. Export ZIP opens; CSVs readable  
6. Turn off network + pause simulation: failed banner shows exact support sentence  

- [ ] **Step 3: Fix defects found; commit**

```bash
git commit -m "docs: add pilot runbook and harden offline paths"
```

---

## Spec coverage checklist

| Spec area | Task(s) |
|-----------|---------|
| Vite PWA + sage brand | 1 |
| Shelter ID initials format | 2, 7 |
| Multi-tenant schema + roles | 3 |
| PowerSync offline sync | 4, 5 |
| Support email + cloud message | 5 |
| Configurable statuses | 6 |
| Animals + search/grid | 7 |
| Photos + R2 | 8 |
| Treatments | 9 |
| Ledger + optional animal | 10 |
| Dashboard + share image + morale | 7, 9, 10, 11 |
| CSV + ZIP export | 12 |
| Pilot / free-tier pause UX | 5, 13 |

## Deferred to later plans (explicitly out of this plan)

- Public pages, social APIs, med schedules, donor CRM, Pro upgrade migration, multi-user invite UX polish, encrypt-at-rest module
