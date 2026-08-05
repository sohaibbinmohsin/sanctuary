# Sanctuary

Shelter management PWA for animal rescues and sanctuaries. Offline-first via PowerSync + Supabase; photos on Cloudflare R2.

## Development

```bash
npm install
cp .env.example .env   # fill values before live sync/login
npm run dev
```

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — type-check and production build
- `npm test` — run Vitest
- `npm run preview` — preview production build

## Environment variables

Copy `.env.example` to `.env`. Do not commit `.env`.

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_POWERSYNC_URL` | PowerSync instance URL |
| `VITE_R2_PUBLIC_BASE_URL` | Public base URL for uploaded photos |
| `VITE_SUPPORT_EMAIL` | Support contact (default `support@themohsinproject.org`) |

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
2. In the SQL editor, run `supabase/migrations/001_initial_schema.sql`.
3. Create the pilot user (Auth → Users → Add user), copy their `user_id`.
4. In `supabase/seed.sql`, replace `:user_id` with that UUID, then run the seed.
5. Confirm the `powersync` publication exists for all tenant tables.
6. Expose tables to the Data API if your project defaults to restricted public schema (needed for PowerSync `uploadData` via supabase-js).

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
