# Sanctuary MVP Design

**Date:** 2026-08-05  
**Product:** Sanctuary — shelter management software by The Mohsin Project  
**First pilot partner:** Tales of Second Chances (Madeeha Khatri), Pakistan  
**Status:** Approved for implementation planning

---

## 1. Purpose & success

Sanctuary helps shelter operators replace memory, scattered notes, and spreadsheets with a mobile-first, offline-capable system for animal records, care history, and money.

**Pilot success (v1):** Madiha runs daily intake, care status, treatments, and donations/expenses in Sanctuary, and can show a simple headcount + financial snapshot to a donor or board member without rebuilding it by hand. Sharing stays simple: copy/download existing data and dashboard→image — not a content or social-media product.

**Longer arc (not all in v1):** Reduce dependence on one person’s memory so others can eventually take over care operations; leave architecture ready for multi-user roles and more shelters.

---

## 2. Context & constraints

- **Scale:** 300+ animals in care at a time; list/search/photo grid must work at that size.
- **Reality of care:** Many animals are long-term sanctuary residents. Adoption is rare. Default workflow centers quarantine → treatment → in-sanctuary, not “intake → adopt.”
- **Connectivity:** Unreliable both at the shelter and in the field. Offline is the default product model for every shipped feature.
- **Pilot users:** Single human (Madiha) at first; schema and auth support multi-user roles from day one.
- **Legal (MOU):** Shelters own their data; The Mohsin Project owns the software IP; export assistance on termination; anonymized aggregate use allowed unless opted out.
- **Hosting budget:** Start on **Supabase Free**; plan to move to Pro when the pilot is daily-critical (Free projects can pause after ~1 week of inactivity). Photo bytes go to **Cloudflare R2**, not Supabase Storage.
- **Language:** English UI; notes and free text must accept Urdu (and any script) without friction.
- **Brand:** Name Sanctuary; sage palette — primary `#87A96B`, background `#F5F1E8`, text `#3E4C3E`.

---

## 3. Goals & non-goals

### Goals (v1)

- Whole-app offline-first (local DB as source of truth; sync in background)
- Animal records with auto shelter ID, optional name, photos, species/markings, configurable statuses
- Simple treatments log (handoff-friendly care history)
- Org-level financial ledger with optional link to an animal
- Dashboard: current in-care headcount + financial snapshot
- Copy / download / dashboard→image exports (partner brand primary, light Sanctuary credit)
- Auth + org membership + roles in schema (only admin active in pilot)
- Multi-tenant single deployment (`org_id` + RLS)

### Non-goals (v1)

- Public pages or “anyone with the link sees all data”
- Social network APIs, scheduling, or AI-generated post content
- Full vet EHR (dosages, schedules, pharmacy inventory)
- Per-animal mandatory financials; donor CRM; adoption pipeline product
- Native iOS/Android apps (PWA only)
- Per-org separate databases
- Multi-org super-admin console; polished volunteer invite flows
- Self-hosted Postgres for the pilot (managed Supabase project under The Mohsin Project)
- Encrypt-at-rest for all sensitive fields as a blocking v1 feature (minimize donor PII; revisit when donors module lands)

---

## 4. Architecture

### Stack (Approach 1)

| Layer | Choice |
|--------|--------|
| Client | Vite + React PWA, mobile-first |
| Local data | SQLite via PowerSync (UI reads/writes local only) |
| Backend | Managed Supabase (Auth + Postgres + RLS) — one project, multi-tenant |
| Files | Cloudflare R2 (images); metadata in Postgres |
| Errors | Sentry (when wired) |
| Email | Resend later (invites); not required for solo pilot |

```text
[Phone: Sanctuary PWA]
  UI → local SQLite (PowerSync)
  photos → local queue → Cloudflare R2
         ↕ sync when online
[Supabase: Auth + Postgres + RLS]
```

### Tenancy

- Single deployment; many orgs later; Tales of Second Chances = org #1.
- Every tenant row carries `org_id`; Supabase RLS enforces membership.
- PowerSync sync rules deliver only the user’s org data.

### Offline model

- No product “offline mode.” Same screens always; local writes always.
- First visit online installs/caches the app shell; afterward the PWA opens without network.
- If Supabase Free pauses: local app keeps working; sync/uploads stall until the project is restored.

### Why not Next.js / DIY sync / Supabase Storage for photos

- Next.js SSR fights local-first PWA; Vite SPA fits the field client.
- DIY IndexedDB sync is out of scope given whole-app offline + photos.
- Supabase Free file storage is ~1 GB — too tight for 300+ animals with essential photos; R2 is the blob store from day one.

---

## 5. Data model

### Tenancy & access

- `organizations`
- `org_members` — user ↔ org, role: `admin` | `staff` | `volunteer`
- Pilot: one org, one admin user. Roles exist from day one; invite UX can wait.

### Configurable per org

- `animal_statuses` — ordered; in-app editor: add / rename / reorder / archive  
  **TOSC starter:** Intake → Quarantine → Treatment → In sanctuary  
  **Optional exits:** Transferred, Deceased, Adopted (available, not the assumed happy path)
- `ledger_categories` — editable donation/expense types  
- Custom profile fields: deferred past first pilot ship

### Animals

- Auto-generated unique **shelter ID** (e.g. `TOSC-0042`) — always present; primary stable handle
- **Name/nickname** — optional
- **Photo** — strongly encouraged at intake; not a hard block if she must save fast (warn once)
- Species/type, sex if known, colors/markings, intake date (default today), current status, notes
- Built for 300+: search by ID/name, filter by status/species, **visual photo grid**

### Treatments

- Append-only log on an animal: date, type (meds / vet / procedure / other), notes, optional link to a ledger entry
- Enough for handoff (“what’s active / what’s been tried”); not a pharmacy or reminder system

### Ledger

- Entries: amount, direction (in/out), category, date, notes, optional `animal_id`
- Org-level first; tag an animal when the cost/donation is specific

### Photos

- `photos` metadata in Postgres: animal_id, r2_key, timestamps, sync/upload state
- Bytes in R2; compress/resize on device before upload

### Identity & money links

- Client-generated UUIDs for offline creates
- Shelter codes from an org-local sequence suitable for single-user pilot; revisit allocation when multi-device staff join

---

## 6. Product modules (screens)

1. **Animals** — list / grid / detail / intake  
2. **Treatments** — on animal detail  
3. **Ledger** — list + add entry  
4. **Dashboard** — in-care headcount + money snapshot  
5. **Settings** — status editor, ledger categories, support contact, optional mute encouragements  
6. **Share** — copy, download, dashboard→image  
7. **Auth** — login (network required at least once)

### Sharing rules

- Export what already exists; do not invent social content
- Dashboard→image and similar: **partner brand primary**, subtle “Powered by Sanctuary” credit
- **No public page** in v1

### Morale UX

- Soft toast after major saves: intake, treatment, ledger, share
- Occasional warm greeting on dashboard open
- English, care-centered, fixed copy list (not AI); mute-able in Settings later if needed

---

## 7. Data flow

1. User action → write local SQLite → UI updates immediately  
2. PowerSync pushes/pulls when online (RLS + sync rules)  
3. Photos: local file + `pending_upload` → R2 via authenticated/signed upload when online → metadata synced  
4. Sync indicator: synced / pending / offline / failed (see errors)  
5. Share/copy/dashboard image reads local data (works offline); OS share sheet hands off to WhatsApp/IG/etc.

### Conflict rules (v1)

- **Append-only** (treatments, ledger, status history): keep both; no silent drop  
- **Editable animal fields:** last-write-wins acceptable for solo pilot; revisit for concurrent multi-user edits  

---

## 8. Error handling

- Local writes are the success path; cloud problems are sync/upload problems, never “your save vanished”
- **Cloud unreachable (exact copy):**  
  `Can’t reach Sanctuary cloud right now. Your data is safe on this phone. Please contact support.`
- Support contact lives in Settings (The Mohsin Project — e.g. WhatsApp/email)
- Photo upload failures retry; show count of waiting photos
- Disk full on device: clear block message
- Auth: first login needs network; expired session keeps local readable; reconnect to sync; no auto-wipe on logout; separate destructive “clear local data”
- Validation: shelter ID auto; species/type + status required; name optional; ledger amount & category required
- Prefer archive/soft-delete over hard delete so history and ledger links survive
- Sentry for client/backend errors when wired
- Never auto-wipe SQLite on migration failure

---

## 9. Security & privacy (v1 bar)

- Org isolation via RLS + PowerSync rules  
- Role column ready; enforce server-side as features expand  
- Minimize donor PII in v1 (ledger notes only as needed)  
- R2 access via short-lived signed uploads/downloads; no public bucket listing of all shelter media  
- Data export path required by MOU — implement a practical export before partner dependence deepens (can follow core loops closely if sequenced in the implementation plan)

---

## 10. Testing

- **Unit:** IDs, totals, status ordering, image compress, export builders  
- **Component:** intake validation, search/filter, editors, ledger form  
- **Offline/sync:** offline create → online appears in Postgres; photo queue → R2; append-only integrity  
- **Tenancy:** second org cannot read first org’s rows  
- **Manual pilot gate:** real Android device, airplane mode intake + photo + expense, reconnect sync, dashboard image to WhatsApp, Urdu notes preserved  

**Ship gate:** offline create + photo queue + ledger entry survive reconnect; dashboard matches a known test set.

---

## 11. Phasing notes

| Now (Free Supabase) | Later |
|---------------------|--------|
| Build and pilot on Free | Upgrade to Pro when daily-critical (no pause, backups, headroom) |
| One admin user | Invite staff/volunteers; tighten concurrent edit rules |
| R2 + aggressive on-device compression | Retention policies / media quotas per org if needed |
| TOSC status starter + simple editor | Richer workflow rules only if requested |
| Copy/download/dashboard image | Optional curated public pages — never “all data public” |

---

## 12. Open points deferred (intentionally)

- Exact shelter ID format string (e.g. `TOSC-####` vs `C-####`) — decide at implementation with Madiha’s preference  
- Support channel URL/number — configure in Settings at deploy time  
- Final morale copy list — write during UI implementation  
- Data export format (JSON/CSV/zip of images) — specify in implementation plan before deep pilot dependence  
- PowerSync hosting/plan details — confirm during plan/spike  

---

## 13. Summary of key decisions

| Topic | Decision |
|--------|----------|
| Offline | Whole app offline-first from day one |
| Client | Vite + React PWA |
| Sync | PowerSync ↔ Supabase Postgres |
| Files | Cloudflare R2 |
| Supabase plan | Free to start; Pro when pilot is critical |
| Core record | Animals; auto ID; optional name |
| Money | Org ledger + optional animal link |
| Care | Simple treatments log |
| Statuses | Per-org editable list; sanctuary-oriented starter |
| Sharing | Copy/download/dashboard image; no public site |
| Users | Multi-role architecture; single admin pilot |
| Language | English UI; Urdu OK in notes |
