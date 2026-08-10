# Trust & Transparency Design

**Date:** 2026-08-10  
**Product:** Sanctuary — shelter management software by The Mohsin Project  
**Status:** Approved for implementation planning  
**Related:** Supersedes the MVP non-goal “no public pages” for an **opt-in, filtered** public transparency page. Does not mean “all data public.”

---

## 1. Purpose & success

Shelters using Sanctuary should be able to show donors and the general public that animals in care and money movement are real — without exposing private staff notes, anonymous-donation proofs, or unverified scraped photos as “proof.”

**Success:**
- An admin can opt in, get a shareable `https://<host>/{slug}` link, and edit the slug.
- A visitor on that link sees animals in care (with care summaries) and filtered ledger detail — not staff UI, not a directory.
- Animal photos taken through the in-app camera path while **online** can show a **verified** mark; gallery uploads and offline camera captures remain allowed but never verified.
- Offline camera: warn that the photo will not be verified, then ask the user to proceed or cancel.
- Public reads and capture-session minting are rate-limited (lighter on reads, stricter on sessions).

**Primary audiences:** donors/fundraisers checking authenticity, and general public / social proof.

---

## 2. Goals & non-goals

### Goals

- Opt-in public transparency page per org at root `/{slug}` (no `/s/` prefix)
- System-assigned default slug on enable; admin-editable; unique; reserved-path safe
- Detailed but filtered public data:
  - Animals: profile + care summary; per care log **Hide from public**
  - Ledger: entries visible by default; **Anonymous (hide attachments)** and **Hide from public** per entry
- Camera-verified animal photos only (not ledger proofs in this design); **verified requires connectivity** (no offline session prefetch)
- Gallery still allowed for staff; never labeled verified
- Offline camera allowed after an explicit warning that the photo will not be verified
- Capture sessions minted server-side at capture time so clients cannot self-attest `verified`
- Public data served only via Edge Function DTO — no anon RLS on live staff tables, no public PowerSync
- Rate limits: both public reads and capture sessions; stricter on sessions

### Non-goals

- Public directory / search of shelters
- Opening PowerSync or membership tables to anonymous users
- Camera verification for ledger/donation proof attachments
- Claiming cryptographic or forensic photo authenticity
- Prefetching capture sessions for offline verified captures
- CAPTCHA, full WAF, or bot ML in v1
- Changing the offline-first staff app model (photos still save offline; only the **verified** mark requires online)

---

## 3. Architecture

Staff keep today’s path. Visitors never receive raw table access.

```text
Staff (authenticated)
  App → PowerSync SQLite → Supabase (membership RLS)
  Animal photo (camera, online)  → capture-session Edge → R2 sign (session-bound) → R2 (verified)
  Animal photo (camera, offline) → warn → proceed? → queue locally → R2 when online (unverified)
  Animal photo (gallery)         → R2 sign → R2 (unverified)

Public (anonymous)
  /{slug} → Public page → public-shelter Edge Function → filtered DTO only
```

| Piece | Role |
|--------|------|
| Org public settings | `public_enabled`, `public_slug` |
| Visibility flags | On treatments/care logs and ledger entries |
| Photo attestation | `capture_source`, `verified` (server-gated) |
| `public-shelter` | Resolve slug → opted-in only → filtered DTO |
| `capture-session` | Auth + membership → short-lived session for verified uploads |
| Rate limits | On both Edge Functions (see §6) |

**Routing:** App routes (`/login`, `/animals`, `/ledger`, `/playground`, etc.) are reserved. Any non-reserved path may resolve as a public slug. Miss → not-found / landing behavior defined in the implementation plan.

---

## 4. Data model & visibility

### Org

| Field | Notes |
|--------|--------|
| `public_enabled` | Default `false` |
| `public_slug` | Unique, nullable until enabled; assigned on enable; admin-editable |

Slug rules: lowercase, URL-safe, unique, rejected if reserved or colliding.

### Animals (public DTO)

When org is opted in, include animals that are in the public-facing care set (exact status filter in implementation plan; intent = currently in care / not archived away from public).

Include: shelter code, optional name, species, sex, markings, status, photos (with verified flag), care/treatment summary **except** rows with `hide_from_public`.

Exclude: fields marked internal-only; hidden care logs.

### Care / treatments

When logging care: **Hide from public** option (default off → public when org page is on).

### Ledger

When adding/editing an entry:

| Option | Public effect |
|--------|----------------|
| **Anonymous (hide attachments)** | Entry may appear (amount/category/date/etc. as designed); **no** attachment URLs or files in public DTO |
| **Hide from public** | Entry omitted entirely from public DTO |

Default: entries are public when the org page is on; attachments omitted only when anonymous (or when the whole entry is hidden).

### Animal photos

| Field | Values / rules |
|--------|----------------|
| `capture_source` | `camera` \| `gallery` |
| `verified` | `true` only when upload is bound to a valid capture session minted **while online at capture time** |

Gallery uploads and offline camera captures: always `verified = false`. Public page may still show them without a trust mark.

---

## 5. Camera capture & verified photos

**Policy:** Verified is **online-only**. No capture-session prefetch for offline use.

### Staff UX

- Keep **Take photo** and **From gallery**
- Camera uses in-app `getUserMedia` → canvas/blob (not a trivially spoofable “camera” file input alone)
- Gallery: existing file picker → unverified

### Online camera (verified path)

1. Take photo while online → request **capture session** (authenticated, org member)
2. Session: short-lived (about 2–5 minutes), bound to `org_id` + `animal_id` (+ user), single-use or tightly limited reuse
3. Capture → compress/queue → R2 sign/upload includes session proof
4. Server sets `verified = true` only if session is valid
5. Missing/expired/reused session after mint: photo may still store as **unverified** (do not block care); never set `verified`

### Offline camera (unverified, with consent)

1. User taps Take photo while offline (or session mint fails due to connectivity)
2. Show a clear message: this photo **will not be verified** (no trust mark on the public page)
3. Ask to **Proceed** or **Cancel**
4. If Proceed: open camera, save with `capture_source = camera`, `verified = false`, queue for upload when online
5. Do not mint or attach a capture session later to “upgrade” an offline photo to verified

### Public UX

- Show photos; **verified** ones get an explicit trust mark
- Unverified photos (gallery or offline camera): visible, no trust mark

### Hardening posture

Best-effort anti-scam: raises the bar for “image from the web → verified on Sanctuary.” Does not stop a compromised staff account or a determined attacker with device control. Product copy must not overclaim.

---

## 6. Rate limiting & abuse

### `public-shelter` (lighter)

- Per IP requests/minute
- Per slug ceiling so shared donor Wi‑Fi is less likely to trip
- Trip → `429` + `Retry-After`, no payload
- Unknown and disabled slugs: same boring not-found shape where practical (limit slug probing)

### `capture-session` (stricter)

- Low burst per user and per org
- Per IP backup cap
- Failed auth counts toward IP limit
- Trip → `429`, no session token

### v1 ops

- Limits via env/config for tuning
- Logs: slug, org id when known, IP hash, outcome
- Out of scope: CAPTCHA, advanced bot detection, directory scraping (no directory)

---

## 7. UX

### Admin

- Toggle **Public transparency page**
- On enable: assign default slug; show full URL; copy link
- Edit slug with inline validation (unique + not reserved)
- Disable: public URL stops resolving immediately

### Staff

- Care: Hide from public
- Ledger: Anonymous (hide attachments) + Hide from public
- Photos: camera vs gallery; verified only after successful **online** session path; offline camera shows warning → proceed/cancel

### Public visitor (`/{slug}`)

- Shelter name as brand; short supporting line; animals in care + expenses
- Care summaries respect hide flags; ledger respects hide/anonymous rules
- No staff chrome, edit affordances, or shelter directory

---

## 8. Error handling

| Case | Behavior |
|------|----------|
| Unknown or disabled slug | Not-found style response |
| Rate limited | `429` + Retry-After; calm retry on public page |
| Offline / no connectivity on Take photo | Warn “won’t be verified” → Proceed (unverified camera) or Cancel |
| Capture session failure (online) | Clear message; offer retry, proceed unverified, or gallery |
| Offline photo later back online | Upload as unverified; **no** late upgrade to verified |
| Slug conflict / reserved | Inline validation; cannot save invalid slug |
| Upload failure | Existing behavior; never mark `verified` on incomplete verified path |

---

## 9. Testing

- **Unit:** slug rules; DTO filtering (hidden care, anonymous attachments omitted, hide entry, verified rules)
- **API:** opted-in vs off; reserved slug rejection; session mint/expire/reuse; rate-limit trip
- **UI:** admin enable/edit/copy; care/ledger toggles; camera vs gallery badge; offline warning → proceed/cancel; no verified upgrade after offline capture
- **Not required:** E2E proof that camera is cryptographically unbypassable — assert session gate + UI paths

---

## 10. Relationship to MVP spec

The 2026-08-05 MVP design listed “public pages” and “anyone with the link sees all data” as non-goals. This design deliberately adds **opt-in, filtered** public pages only. Staff-private data, anonymous attachments, and hidden care/ledger rows stay off the public DTO. Sharing via copy/download/dashboard image remains available; public pages are an additional, explicit transparency channel.
