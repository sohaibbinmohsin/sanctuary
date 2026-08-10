# Trust & Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship opt-in public shelter pages at `/{slug}` plus online-only camera-verified animal photos, without opening live staff tables to anonymous clients.

**Architecture:** Staff stay on PowerSync + membership RLS. A `public-shelter` Edge Function (anon, rate-limited) returns a filtered DTO for opted-in orgs. A `capture-session` Edge Function mints short-lived sessions; `r2-sign` may set `photos.verified` only when a valid session is presented. Verified requires connectivity at capture time; offline camera warns then saves unverified.

**Tech Stack:** Existing Vite/React PWA, PowerSync, Supabase Edge Functions (Deno), Postgres RLS, Cloudflare R2, Vitest

**Spec:** `docs/superpowers/specs/2026-08-10-trust-transparency-design.md`

## Global Constraints

- No anon RLS on live shelter tables; public data only via `public-shelter` DTO
- No public PowerSync buckets; no shelter directory
- Root URL `/{slug}` (no `/s/` prefix); reserved paths must never resolve as slugs
- Verified photos: online-only; no session prefetch; no late upgrade of offline captures
- Gallery always unverified; ledger proof camera verification out of scope
- Brand: primary `#87A96B`, background `#F5F1E8`, text `#3E4C3E`
- Tests only under top-level `tests/` (never under `src/`)
- Prefer soft-delete/archive; English UI; free text accepts Urdu/Unicode
- Rate limits: lighter on `public-shelter`, stricter on `capture-session`; `429` + `Retry-After`
- Product copy must not claim forensic/cryptographic authenticity

**Execution waves:** Phase A (Tasks 1–8) ships public pages without requiring verified badges. Phase B (Tasks 9–12) adds capture sessions + verified marks. Each wave should leave `npm test` and `npm run build` green.

---

## File structure (target)

```text
supabase/migrations/
  YYYYMMDDHHMMSS_trust_transparency.sql
supabase/functions/
  public-shelter/index.ts
  capture-session/index.ts
  r2-sign/index.ts                    # extend
  _shared/rateLimit.ts                # new
  _shared/cors.ts                     # optional extract
src/shared/lib/public/
  slug.ts                             # normalize, reserved, default
  visibility.ts                       # pure DTO filter helpers / types
src/features/settings/domain/
  publicPage.ts                       # enable/disable/update slug (local SQLite)
src/features/public/
  api/fetchPublicShelter.ts
  screens/PublicShelterScreen.tsx
  components/VerifiedPhotoBadge.tsx
src/features/animals/components/
  PhotoCapture.tsx                    # getUserMedia + offline warn
  InAppCamera.tsx                     # new
src/app/App.tsx                       # unsigned /{slug} routing
```

Also modify: PowerSync `schema.ts`, `hydrateOrgBootstrap.ts`, treatments/ledger domains + forms, `photos.ts`, `upload.ts`, `SettingsScreen.tsx`, `supabase/config.toml`, `powersync/sync-streams.yaml` (only if new synced columns need declaration — columns on existing tables sync automatically once in schema).

---

### Task 1: Public slug helpers (pure)

**Files:**
- Create: `src/shared/lib/public/slug.ts`
- Test: `tests/unit/shared/publicSlug.test.ts`

**Interfaces:**
- Produces:
  - `RESERVED_PUBLIC_SLUGS: ReadonlySet<string>`
  - `normalizePublicSlug(raw: string): string`
  - `isReservedPublicSlug(slug: string): boolean`
  - `isValidPublicSlugFormat(slug: string): boolean`
  - `defaultPublicSlug(orgName: string, initials: string): string`
  - `publicShelterPath(slug: string): string` → `/${slug}`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import {
  normalizePublicSlug,
  isReservedPublicSlug,
  isValidPublicSlugFormat,
  defaultPublicSlug,
  publicShelterPath,
} from '@/shared/lib/public/slug'

describe('public slug', () => {
  it('normalizes to lowercase kebab', () => {
    expect(normalizePublicSlug('  ToSc Shelter ')).toBe('tosc-shelter')
  })

  it('rejects reserved paths', () => {
    expect(isReservedPublicSlug('login')).toBe(true)
    expect(isReservedPublicSlug('animals')).toBe(true)
    expect(isReservedPublicSlug('tosc')).toBe(false)
  })

  it('validates format', () => {
    expect(isValidPublicSlugFormat('tosc')).toBe(true)
    expect(isValidPublicSlugFormat('tales-of-second-chances')).toBe(true)
    expect(isValidPublicSlugFormat('ab')).toBe(false) // min 3
    expect(isValidPublicSlugFormat('-tosc')).toBe(false)
  })

  it('defaults from initials when available', () => {
    expect(defaultPublicSlug('Tales of Second Chances', 'TOSC')).toBe('tosc')
  })

  it('builds path', () => {
    expect(publicShelterPath('tosc')).toBe('/tosc')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/shared/publicSlug.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
/** Paths and first URL segments that must never be public slugs. */
export const RESERVED_PUBLIC_SLUGS = new Set([
  '',
  'login',
  'animals',
  'ledger',
  'dashboard',
  'settings',
  'playground',
  'api',
  'assets',
  'favicon.ico',
  'manifest.webmanifest',
  'sw.js',
  'index.html',
])

export function normalizePublicSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function isReservedPublicSlug(slug: string): boolean {
  return RESERVED_PUBLIC_SLUGS.has(slug.toLowerCase())
}

/** 3–48 chars, starts/ends alphanumeric, kebab-case. */
export function isValidPublicSlugFormat(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(slug) && slug.length >= 3
}

export function defaultPublicSlug(orgName: string, initials: string): string {
  const fromInitials = normalizePublicSlug(initials)
  if (
    fromInitials.length >= 3 &&
    isValidPublicSlugFormat(fromInitials) &&
    !isReservedPublicSlug(fromInitials)
  ) {
    return fromInitials
  }
  const fromName = normalizePublicSlug(orgName)
  if (isValidPublicSlugFormat(fromName) && !isReservedPublicSlug(fromName)) {
    return fromName
  }
  // Fallback: pad short initials
  const padded = (fromInitials || 'org').padEnd(3, '0').slice(0, 48)
  return isReservedPublicSlug(padded) ? `${padded}-shelter` : padded
}

export function publicShelterPath(slug: string): string {
  return `/${slug}`
}

export function canUsePublicSlug(slug: string): boolean {
  return isValidPublicSlugFormat(slug) && !isReservedPublicSlug(slug)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/shared/publicSlug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/public/slug.ts tests/unit/shared/publicSlug.test.ts
git commit -m "Add public slug validation helpers."
```

---

### Task 2: Public visibility DTO helpers (pure)

**Files:**
- Create: `src/shared/lib/public/visibility.ts`
- Test: `tests/unit/shared/publicVisibility.test.ts`

**Interfaces:**
- Produces types + `buildPublicShelterDto(input)` used as the contract the Edge Function must match (SQL filters mirror these rules).

```ts
export type PublicPhotoDto = {
  id: string
  url: string
  verified: boolean
}

export type PublicCareDto = {
  id: string
  treatedAt: string
  treatmentType: string
  notes: string | null
}

export type PublicAnimalDto = {
  id: string
  shelterCode: string
  name: string | null
  species: string | null
  sex: string | null
  markings: string | null
  statusLabel: string
  photos: PublicPhotoDto[]
  care: PublicCareDto[]
}

export type PublicLedgerDto = {
  id: string
  direction: 'in' | 'out'
  amountCents: number
  entryDate: string
  categoryLabel: string
  notes: string | null
  animalId: string | null
  isAnonymous: boolean
  /** Always empty when isAnonymous; otherwise public attachment URLs if any. */
  attachmentUrls: string[]
}

export type PublicShelterDto = {
  orgName: string
  slug: string
  animals: PublicAnimalDto[]
  ledger: PublicLedgerDto[]
}
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildPublicShelterDto } from '@/shared/lib/public/visibility'

describe('buildPublicShelterDto', () => {
  const base = {
    orgName: 'Tales of Second Chances',
    slug: 'tosc',
    animals: [
      {
        id: 'a1',
        shelterCode: 'TOSC-0001',
        name: 'Barnaby',
        species: 'dog',
        sex: 'male',
        markings: null,
        statusLabel: 'In sanctuary',
        archived: false,
        countsAsInCare: true,
        photos: [
          { id: 'p1', url: 'https://cdn/p1.jpg', verified: true },
          { id: 'p2', url: 'https://cdn/p2.jpg', verified: false },
        ],
        care: [
          {
            id: 'c1',
            treatedAt: '2026-01-01',
            treatmentType: 'meds',
            notes: 'visible',
            hideFromPublic: false,
          },
          {
            id: 'c2',
            treatedAt: '2026-01-02',
            treatmentType: 'vet',
            notes: 'secret',
            hideFromPublic: true,
          },
        ],
      },
      {
        id: 'a2',
        shelterCode: 'TOSC-0002',
        name: 'Gone',
        species: 'cat',
        sex: null,
        markings: null,
        statusLabel: 'Adopted',
        archived: false,
        countsAsInCare: false,
        photos: [],
        care: [],
      },
    ],
    ledger: [
      {
        id: 'l1',
        direction: 'in' as const,
        amountCents: 500000,
        entryDate: '2026-01-03',
        categoryLabel: 'Donation',
        notes: 'Thanks',
        animalId: null,
        isAnonymous: true,
        hideFromPublic: false,
        attachmentUrls: ['https://cdn/receipt.jpg'],
      },
      {
        id: 'l2',
        direction: 'out' as const,
        amountCents: 10000,
        entryDate: '2026-01-04',
        categoryLabel: 'Food',
        notes: null,
        animalId: 'a1',
        isAnonymous: false,
        hideFromPublic: true,
        attachmentUrls: [],
      },
      {
        id: 'l3',
        direction: 'out' as const,
        amountCents: 20000,
        entryDate: '2026-01-05',
        categoryLabel: 'Vet',
        notes: 'Clinic',
        animalId: 'a1',
        isAnonymous: false,
        hideFromPublic: false,
        attachmentUrls: ['https://cdn/bill.jpg'],
      },
    ],
  }

  it('keeps in-care animals, strips hidden care, keeps verified flags', () => {
    const dto = buildPublicShelterDto(base)
    expect(dto.animals).toHaveLength(1)
    expect(dto.animals[0]!.care.map((c) => c.id)).toEqual(['c1'])
    expect(dto.animals[0]!.photos[0]!.verified).toBe(true)
  })

  it('omits hidden ledger rows and strips anonymous attachments', () => {
    const dto = buildPublicShelterDto(base)
    expect(dto.ledger.map((e) => e.id)).toEqual(['l1', 'l3'])
    expect(dto.ledger[0]!.attachmentUrls).toEqual([])
    expect(dto.ledger[1]!.attachmentUrls).toEqual(['https://cdn/bill.jpg'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/shared/publicVisibility.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `buildPublicShelterDto`**

Filter rules (exact):
1. Animals: `!archived && countsAsInCare`
2. Care: drop `hideFromPublic`
3. Ledger: drop `hideFromPublic`; if `isAnonymous`, force `attachmentUrls = []`
4. Do not include internal-only fields beyond the DTO types

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/public/visibility.ts tests/unit/shared/publicVisibility.test.ts
git commit -m "Add public shelter DTO visibility helpers."
```

---

### Task 3: Database migration (trust columns + capture sessions + rate buckets)

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_trust_transparency.sql` (use `npx supabase migration new trust_transparency` for the timestamp)
- Modify if needed: `scripts/db-setup.mjs` only if it hard-codes column lists (prefer not)

**Interfaces:**
- Produces Postgres columns/tables consumed by later tasks

- [ ] **Step 1: Create migration SQL**

```sql
-- Org public page
alter table organizations
  add column if not exists public_enabled boolean not null default false,
  add column if not exists public_slug text;

create unique index if not exists organizations_public_slug_uidx
  on organizations (public_slug)
  where public_slug is not null;

-- Care / ledger visibility
alter table treatments
  add column if not exists hide_from_public boolean not null default false;

alter table ledger_entries
  add column if not exists hide_from_public boolean not null default false;

-- Animal photo attestation (clients may write capture_source; verified enforced below)
alter table photos
  add column if not exists capture_source text not null default 'gallery'
    check (capture_source in ('camera', 'gallery')),
  add column if not exists verified boolean not null default false;

-- Prevent clients from self-attesting verified via synced writes
create or replace function public.photos_enforce_verified()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.verified := false;
  elsif tg_op = 'UPDATE' then
    -- service_role bypasses RLS; detect via claim when available, else allow only
    -- verified changes that do not flip false→true from authenticated JWT role.
    if new.verified is distinct from old.verified then
      if current_setting('request.jwt.claim.role', true) = 'service_role'
         or current_user = 'service_role'
         or current_user = 'supabase_admin'
         or current_user = 'postgres' then
        return new;
      end if;
      new.verified := old.verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists photos_enforce_verified_trg on photos;
create trigger photos_enforce_verified_trg
  before insert or update on photos
  for each row execute function public.photos_enforce_verified();

-- Capture sessions (Edge / service_role only — not in PowerSync)
create table if not exists photo_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  user_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  photo_id uuid references photos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table photo_capture_sessions enable row level security;
-- No policies for authenticated/anon — only service_role

-- Durable rate-limit buckets for Edge Functions
create table if not exists edge_rate_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  hit_count int not null default 0
);

alter table edge_rate_buckets enable row level security;
-- No client policies
```

Tune the verified trigger if local `current_user` checks differ in Supabase — the Edge Function that sets `verified` must use the **service role** client.

- [ ] **Step 2: Apply on DEV**

Run: `npm run db:push` (or project’s documented migrate path)
Expected: migration applied without error

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*trust_transparency.sql
git commit -m "Add trust transparency schema columns and session tables."
```

---

### Task 4: PowerSync schema + hydrate + domain flags

**Files:**
- Modify: `src/features/sync/powersync/schema.ts`
- Modify: `src/features/sync/hydrateOrgBootstrap.ts` (org select list)
- Modify: `src/features/treatments/domain/treatments.ts`
- Modify: `src/features/ledger/domain/ledger.ts`
- Modify: `src/features/photos/domain/photos.ts` (`queuePhoto` inputs)
- Modify: `src/shared/hooks/useCurrentMember.ts` (expose `publicEnabled` / `publicSlug` if settings need them from member hook — or read org row in Settings)

**Interfaces:**
- Consumes: migration columns
- Produces: local columns available offline; `AddTreatmentInput.hideFromPublic?: boolean`; `AddLedgerInput.hideFromPublic?: boolean`; `queuePhoto(..., { captureSource, verified?: never })`

- [ ] **Step 1: Extend PowerSync tables**

```ts
// organizations
public_enabled: column.integer, // 0/1
public_slug: column.text,

// treatments
hide_from_public: column.integer,

// ledger_entries
hide_from_public: column.integer,

// photos
capture_source: column.text,
verified: column.integer,
```

- [ ] **Step 2: Update `addTreatment` / `updateTreatment` / ledger add-update** to persist `hide_from_public` (0/1). Default `0`.

- [ ] **Step 3: Update `queuePhoto`**

```ts
export async function queuePhoto(
  db: SanctuaryDb,
  input: {
    orgId: string
    animalId: string
    blob: Blob
    captureSource: 'camera' | 'gallery'
  },
): Promise<PhotoRecord> {
  // INSERT … capture_source, verified=0 always
}
```

Update `processPhotoQueue` return typing / row mapping for new columns. Do **not** set `verified=1` from the client.

- [ ] **Step 4: Update hydrate org select** to include `public_enabled, public_slug`.

- [ ] **Step 5: Run `npm test` and `npm run build`**
Expected: PASS (fix any call sites of `queuePhoto` that need `captureSource`)

- [ ] **Step 6: Commit**

```bash
git add src/features/sync src/features/treatments src/features/ledger src/features/photos src/shared/hooks
git commit -m "Sync trust columns into PowerSync and domain writes."
```

---

### Task 5: Staff UI — settings public page + care/ledger toggles

**Files:**
- Create: `src/features/settings/domain/publicPage.ts`
- Modify: `src/features/settings/screens/SettingsScreen.tsx`
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx` (care form)
- Modify: `src/features/ledger/screens/LedgerEntryScreen.tsx`

**Interfaces:**
- Produces:
  - `enablePublicPage(db, { orgId, orgName, initials }): Promise<{ slug: string }>`
  - `disablePublicPage(db, orgId): Promise<void>`
  - `updatePublicSlug(db, orgId, slug): Promise<void>` — throws on invalid/reserved; uniqueness conflicts surface on sync/API later — for v1 also call a small authenticated edge check **or** rely on unique index + sync error. Prefer: attempt local write; document that slug uniqueness is enforced in Postgres on sync. Optional Task 5b: `check-public-slug` edge — **YAGNI** unless collisions are likely; unique index is enough for pilot.

- [ ] **Step 1: Implement `publicPage.ts`**

On enable: `defaultPublicSlug(orgName, initials)` → `UPDATE organizations SET public_enabled=1, public_slug=?`.
On disable: `public_enabled=0` (keep slug for re-enable convenience, or clear — **keep slug**).
On update slug: `canUsePublicSlug` then update.

- [ ] **Step 2: Settings UI section “Public transparency”**

- Toggle enable
- Show full URL using `window.location.origin + publicShelterPath(slug)`
- Edit slug + Save
- Copy link button
- Short help: “Donors can open this link. Private care notes and anonymous proofs stay hidden when you mark them.”

- [ ] **Step 3: Care form checkbox “Hide from public”** bound to `hideFromPublic`

- [ ] **Step 4: Ledger form checkbox “Hide from public”** (all directions). Keep existing “Anonymous donation” (in only) — help text: “Hides proof attachments on the public page.”

- [ ] **Step 5: Manual smoke in DEV — enable, copy link (page 404 until Task 7/8), toggle flags on a care/ledger row

- [ ] **Step 6: Commit**

```bash
git add src/features/settings src/features/animals/screens/AnimalDetailScreen.tsx src/features/ledger/screens/LedgerEntryScreen.tsx
git commit -m "Add public page settings and visibility toggles."
```

---

### Task 6: Edge shared rate limiter

**Files:**
- Create: `supabase/functions/_shared/rateLimit.ts`
- Create: `tests/unit/shared/rateLimitWindow.test.ts` for pure window helper if extracted to `src/shared/lib/public/rateLimitWindow.ts` (optional mirror)

**Interfaces:**
- Produces: `async function consumeRateLimit(admin: SupabaseClient, opts: { bucketKey: string; limit: number; windowSeconds: number }): Promise<{ allowed: boolean; retryAfterSeconds: number }>`

Algorithm:
1. Read `edge_rate_buckets` for `bucketKey`
2. If missing or `now - window_start >= windowSeconds`, reset `window_start=now`, `hit_count=1`, allow
3. Else if `hit_count < limit`, increment, allow
4. Else deny with `retryAfterSeconds = windowSeconds - elapsed`

Env defaults (document in function comments):
- `public-shelter`: 60/min/IP, 120/min/slug
- `capture-session`: 10/min/user, 20/min/org, 30/min/IP

- [ ] **Step 1: Implement `_shared/rateLimit.ts`** using service-role Supabase client passed in

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/rateLimit.ts
git commit -m "Add Edge Function rate limit helper."
```

---

### Task 7: `public-shelter` Edge Function

**Files:**
- Create: `supabase/functions/public-shelter/index.ts`
- Modify: `supabase/config.toml` → `[functions.public-shelter] verify_jwt = false`
- Create: `src/features/public/api/fetchPublicShelter.ts` (client caller)

**Interfaces:**
- `GET` or `POST` with `{ slug: string }`
- Success `200`: body matching `PublicShelterDto`
- Missing/disabled: `404` with identical boring JSON `{ error: 'not_found' }`
- Rate limited: `429` + `Retry-After`

SQL filter (must match Task 2 rules):
- Org: `public_enabled = true AND public_slug = $slug`
- Animals: `archived = false` AND join status `counts_as_in_care = true`
- Treatments: `hide_from_public = false`
- Ledger: `hide_from_public = false`; if `is_anonymous` omit attachment URLs (do not select attachments for those rows)
- Photos: include `verified`, build URL from `R2_PUBLIC_BASE_URL` + key (same as app)
- **Do not** return `notes` fields marked private — animal `notes` excluded from DTO entirely

Use **service role** inside the function only after slug resolves to an opted-in org.

- [ ] **Step 1: Implement function** — map rows through the same field names as `PublicShelterDto`. Prefer importing rule comments referencing `visibility.ts`.

- [ ] **Step 2: Client helper**

```ts
export async function fetchPublicShelter(slug: string): Promise<
  | { ok: true; data: PublicShelterDto }
  | { ok: false; status: number; retryAfterSeconds?: number }
>
```

Uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon key OK; JWT verify off).

- [ ] **Step 3: Deploy DEV**

Run: `npm run functions:deploy -- public-shelter`
Expected: deployed

- [ ] **Step 4: Manual curl** — enabled slug returns DTO; disabled returns 404; hammer to see 429

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/public-shelter supabase/config.toml src/features/public/api/fetchPublicShelter.ts
git commit -m "Add public-shelter Edge Function and client fetch."
```

---

### Task 8: Public page UI + unsigned routing

**Files:**
- Create: `src/features/public/screens/PublicShelterScreen.tsx`
- Create: `src/features/public/components/VerifiedPhotoBadge.tsx` (can render nothing useful until Phase B; still accept `verified` prop)
- Modify: `src/app/App.tsx`

**Interfaces:**
- Route: unsigned `/:slug` when `canUsePublicSlug(slug)` / not reserved
- Reserved and unknown → existing landing redirect or a small NotFound — **spec:** unknown slug → not-found style. Implement `PublicShelterScreen` showing “This shelter page isn’t available.” on 404 without revealing disabled vs missing.

- [ ] **Step 1: Update unsigned routes in `App.tsx`**

```tsx
<Routes>
  <Route path="/" element={<LandingScreen />} />
  <Route path="/login" element={<LoginScreen … />} />
  <Route path="/:slug" element={<PublicShelterScreen />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Inside `PublicShelterScreen`, if `isReservedPublicSlug(slug)` → `<Navigate to="/" replace />`.

Signed-in users visiting `/{slug}`: allow viewing public page **or** redirect into app — **choose: still show public page** (donors may be logged-in staff). Add a staff route exception so `AppShell` does not steal `/:slug`. In signed-in branch, register `/ :slug` **before** `*` AppShell **only for valid non-reserved slugs**, or always prefer AppShell for known app paths. Simplest approach:

- Signed-in: keep AppShell on `*` but add explicit routes for app paths in `router.tsx` (already) — conflict: `*` catches everything including `/tosc`.
- Fix: In signed-in `Routes`, list known app prefixes via AppShell and add `<Route path="/:slug" element={<PublicShelterScreen />} />` **before** `<Route path="*" element={<AppShell />} />`. AppShell’s internal router currently owns `/animals` etc. So structure:

```tsx
// signed in
<Routes>
  <Route path="/login" element={<Navigate to="/animals" />} />
  <Route path="/:slug" element={<PublicSlugOrApp />} />
</Routes>
```

Where `PublicSlugOrApp` checks reserved/app first-segment against a set of **app roots** (`animals`, `ledger`, …): if match, render `<AppShell />`, else `<PublicShelterScreen />`.

Alternatively keep AppShell as today and mount public only when signed out — **worse for staff preview**. Prefer `PublicSlugOrApp` gate.

- [ ] **Step 2: Build `PublicShelterScreen`**

- Brand: org name hero
- One short supporting line about transparency
- Animals list with photos; show `VerifiedPhotoBadge` when `photo.verified`
- Care summary per animal
- Ledger list/totals (no attachment UI when `attachmentUrls` empty / anonymous)
- 429 → calm “Too many requests. Try again in a moment.”
- Loading / error states

Follow existing brand tokens; no staff chrome.

- [ ] **Step 3: Manual test** — signed out open `/tosc`; reserved `/login` unchanged; signed in `/animals` still works

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx src/features/public
git commit -m "Add public shelter page and slug routing."
```

---

### Task 9: `capture-session` Edge Function

**Files:**
- Create: `supabase/functions/capture-session/index.ts`
- Modify: `supabase/config.toml` → `[functions.capture-session] verify_jwt = true`
- Create: `src/shared/lib/r2/captureSession.ts` — `requestCaptureSession({ animalId }): Promise<{ sessionId: string; token: string; expiresAt: string }>`

**Interfaces:**
- POST body: `{ animalId: string }`
- Auth: user JWT; must be `org_members` for the animal’s `org_id`
- Creates `photo_capture_sessions` row with `token_hash = sha256(token)`, `expires_at = now+3 minutes`
- Returns `{ sessionId, token, expiresAt }` once (token plaintext only in response)
- Rate limits: per user, per org, per IP (stricter)
- 401/403/429/400 as appropriate

- [ ] **Step 1: Implement + deploy**

- [ ] **Step 2: Client helper with auth Bearer token (same pattern as `upload.ts`)**

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/capture-session supabase/config.toml src/shared/lib/r2/captureSession.ts
git commit -m "Add capture-session Edge Function for verified photos."
```

---

### Task 10: Bind verified uploads in `r2-sign` + photo queue

**Files:**
- Modify: `supabase/functions/r2-sign/index.ts`
- Modify: `src/shared/lib/r2/upload.ts` — `requestSignedUpload(key, opts?: { captureToken?: string; photoId?: string })`
- Modify: `src/features/photos/domain/photos.ts` — store pending token in memory/module map keyed by photo id (not synced); `processPhotoQueue` passes token when present

**Interfaces:**
- When `captureToken` + `photoId` present and valid unused unexpired session matching key’s `orgId/animalId`:
  1. Mark session `used_at`, set `photo_id`
  2. `UPDATE photos SET verified = true WHERE id = photoId` via **service role**
  3. Return signed URL as today
- Invalid token: still allow upload URL, **do not** set verified (and do not fail the upload)
- Never trust client-sent `verified`

Pending token map:

```ts
// photos.ts
const pendingCaptureTokens = new Map<string, string>()

export function rememberCaptureToken(photoId: string, token: string) {
  pendingCaptureTokens.set(photoId, token)
}
```

`queuePhoto` after online verified capture calls `rememberCaptureToken`. Offline/gallery never set a token.

- [ ] **Step 1: Extend r2-sign**

- [ ] **Step 2: Wire queue processor**

- [ ] **Step 3: Deploy r2-sign**

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/r2-sign src/shared/lib/r2/upload.ts src/features/photos/domain/photos.ts
git commit -m "Bind capture sessions to R2 sign for verified photos."
```

---

### Task 11: In-app camera + offline warning UX

**Files:**
- Create: `src/features/animals/components/InAppCamera.tsx`
- Modify: `src/features/animals/components/PhotoCapture.tsx`

**Interfaces:**
- `InAppCamera`: `getUserMedia({ video: { facingMode: 'environment' } })` → canvas capture → `Blob` → `onCapture(blob)` / `onCancel`
- `PhotoCapture` flow:
  1. Take photo tapped
  2. If `navigator.onLine === false` **or** `requestCaptureSession` fails with network: modal “This photo won’t be verified on the public page.” → Proceed | Cancel
  3. Proceed offline: open `InAppCamera`, `queuePhoto({ captureSource: 'camera' })` without token
  4. Online success: mint session → `InAppCamera` → `queuePhoto` + `rememberCaptureToken`
  5. Gallery: file input without capture → `queuePhoto({ captureSource: 'gallery' })` never verified
  6. Online session failure after connect: offer Retry / Proceed unverified / Cancel

Remove reliance on `<input capture="environment">` for the verified path.

- [ ] **Step 1: Implement InAppCamera**

- [ ] **Step 2: Wire PhotoCapture**

- [ ] **Step 3: Manual test** — online verified badge after sync; offline warn; gallery no badge

- [ ] **Step 4: Commit**

```bash
git add src/features/animals/components/PhotoCapture.tsx src/features/animals/components/InAppCamera.tsx
git commit -m "Use in-app camera with online-only verification."
```

---

### Task 12: Verified badge polish + final verification

**Files:**
- Modify: `src/features/public/components/VerifiedPhotoBadge.tsx`
- Modify: `src/features/animals/screens/AnimalDetailScreen.tsx` (optional staff-side indicator on thumbnails)
- Test: extend `tests/unit/shared/publicVisibility.test.ts` if needed

- [ ] **Step 1: Badge copy** — short accessible label e.g. `aria-label="Verified in-app camera photo"` visible mark “Verified” (not “authentic” / “guaranteed real”)

- [ ] **Step 2: Run full suite**

```bash
npm test
npm run build
```

Expected: PASS

- [ ] **Step 3: End-to-end manual checklist**

1. Enable public page, open `/{slug}` signed out — animals in care + ledger
2. Hide care log → disappears from public
3. Anonymous donation → entry visible, no attachments
4. Hide ledger entry → omitted
5. Online camera photo → verified on public after upload/sync
6. Offline camera → warning → unverified
7. Gallery → unverified
8. Rate-limit trip returns calm UI
9. Reserved path `/animals` unaffected

- [ ] **Step 4: Commit**

```bash
git add src/features/public src/features/animals
git commit -m "Polish verified photo badge and finish trust transparency."
```

---

## Self-review (plan vs spec)

| Spec requirement | Task(s) |
|------------------|---------|
| Opt-in + editable slug at `/{slug}` | 1, 5, 8 |
| Default slug on enable | 1, 5 |
| Filtered animals + care hide | 2, 3, 4, 5, 7 |
| Ledger anonymous attachments + hide entry | 2, 3, 4, 5, 7 |
| Edge DTO only / no anon RLS on live tables | 7 |
| Rate limits both endpoints | 6, 7, 9 |
| Online-only verified + offline warn/proceed | 9–11 |
| Gallery allowed unverified | 11 |
| Capture session server-gated verified | 3, 9, 10 |
| No directory / no ledger camera verify / no prefetch | Non-goals honored |
| Testing slug + DTO + manual API/UI | 1, 2, 7, 12 |

No intentional TBD placeholders remain; animal public set defined as `archived = false AND counts_as_in_care = true`.
