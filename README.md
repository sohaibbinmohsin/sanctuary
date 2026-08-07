# Sanctuary

Shelter management PWA for animal rescues and sanctuaries. Offline-first via PowerSync + Supabase; photos on Cloudflare R2.

## Development

```bash
npm install
cp .env.example .env.local   # fill VITE_* + DATABASE_URL + SEED_USER_ID
```

### One-time database setup (no SQL copy-paste)

1. Create a user in Supabase **Authentication → Users** and copy their UUID into `SEED_USER_ID`.
2. Copy the Database **URI** from Project Settings → Database into `DATABASE_URL` (with the real DB password).
3. Run:

```bash
npm run db:setup
```

This applies `supabase/migrations/001_initial_schema.sql` and seeds Tales of Second Chances. Safe to re-run (skips migrate if tables exist; seed is idempotent).

Then start the app:

```bash
npm run dev
```

Or migrate+seed then start in one go:

```bash
npm run dev:setup
```

> Migrations are **not** run on every plain `npm run dev` — that needs the DB password and would surprise you on every restart. Use `db:setup` / `dev:setup` when you need schema.

## Scripts

- `npm run dev` — start Vite dev server
- `npm run db:setup` — apply schema + seed (needs `DATABASE_URL`, `SEED_USER_ID`)
- `npm run dev:setup` — `db:setup` then Vite
- `npm run build` — type-check and production build
- `npm test` — run Vitest
- `npm run preview` — preview production build

## Environment variables

Copy `.env.example` to `.env.local`. Do not commit `.env.local`.

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (preferred; new dashboard name) |
| `VITE_SUPABASE_ANON_KEY` | Legacy alias — optional if publishable key is set |
| `VITE_POWERSYNC_URL` | PowerSync instance URL |
| `VITE_R2_PUBLIC_BASE_URL` | Public base URL for uploaded photos |
| `VITE_SUPPORT_EMAIL` | Support contact (default `support@themohsinproject.org`) |
| `DATABASE_URL` | Postgres URI for `npm run db:setup` only (not used by the Vite app) |
| `SEED_USER_ID` | Auth user UUID to attach as TOSC admin during seed |

### Edge Function secrets (R2 signing)

Deploy `supabase/functions/r2-sign` and set:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_ENDPOINT`
- `R2_PUBLIC_BASE_URL`

Also ensure the function can read `SUPABASE_URL` and `SUPABASE_ANON_KEY` (provided by Supabase).

## Supabase setup

1. Create a Free Supabase project.
2. Add `DATABASE_URL` + create an Auth user and set `SEED_USER_ID` in `.env.local`.
3. Run `npm run db:setup` (applies migration + TOSC seed).
4. Confirm the `powersync` publication exists (created by the migration).
5. Expose tables to the Data API if your project defaults to restricted public schema (needed for PowerSync `uploadData` via supabase-js).

Manual SQL files remain under `supabase/migrations/` and `supabase/seed.sql` if you prefer the dashboard.

## PowerSync setup

1. Create a PowerSync instance connected to the Supabase Postgres database.
2. Deploy sync rules from `powersync/sync-rules.yaml` (or translate to Sync Streams with the same org membership filter).
3. Configure Supabase JWT auth so PowerSync accepts the user’s access token.
4. Set `VITE_POWERSYNC_URL` to the instance URL.

## Cloudflare R2 setup

1. Create a bucket for animal photos.
2. Configure CORS to allow `PUT`/`GET` from your PWA origin.
3. Create an API token with object read/write.
4. Set Edge Function secrets and `VITE_R2_PUBLIC_BASE_URL` (custom domain or r2.dev public URL).

## Pilot runbook (Android Chrome)

Automated tests cover IDs, CSV export escaping (including Urdu), and support copy. The following must still be verified on a real device with live credentials:

1. Install PWA (Add to Home Screen).
2. Airplane mode: intake animal + photo + expense + treatment with Urdu notes — UI stays usable; SyncBanner shows offline.
3. Reconnect: rows appear in Supabase; photo lands in R2; banner returns toward synced.
4. Dashboard → Share / Download PNG; share image to WhatsApp when Web Share is available.
5. Settings → Export my data — ZIP opens with `animals.csv`, `treatments.csv`, `ledger.csv`, and `images/`.
6. Simulate cloud failure (network off while app expects sync, or pause Free project): failed banner shows exactly:

   `Can't reach Sanctuary cloud right now. Your data is safe on this phone. Please contact support.`

## Project layout

- `src/app` — shell, router, providers
- `src/features/*` — auth, animals, treatments, ledger, statuses, photos, dashboard, settings, sync
- `src/shared/*` — UI, hooks, export, IDs, R2 helpers
- `tests/` — unit/integration only (never under `src/`)
- `supabase/` — migrations, seed, edge functions
- `powersync/` — sync rules
