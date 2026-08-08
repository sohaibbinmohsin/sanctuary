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
- `npm run db:setup` — apply schema + seed on DEV (needs `DATABASE_URL`, `SEED_USER_ID`)
- `npm run db:push` — push migrations to Sanctuary DEV via CLI
- `npm run functions:deploy` — deploy edge functions to Sanctuary DEV
- `npm run supabase:link` — link CLI to Sanctuary DEV
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

## Environments (dev vs production)

| | Local / day-to-day | Production |
|---|-------------------|------------|
| Supabase project | **Sanctuary** (`nsplqqaihekmmfznbkzb`) | **sanctuary-prod** (`azfzhbxyxnfqvjehemus`) |
| How schema/functions deploy | `npm run db:push` / `npm run functions:deploy` (always DEV) | GitHub Action on push to `main` |
| App env | `.env.local` → DEV keys + PowerSync | Vercel Production env → prod keys |

**Rule:** never `supabase link` or deploy to prod from your laptop. Production is CI-only (`.github/workflows/supabase-production.yml`). The `scripts/supabase-dev.mjs` wrapper refuses the prod project ref.

### GitHub secrets (for prod CI)

In the repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | [Account access token](https://supabase.com/dashboard/account/tokens) |
| `PRODUCTION_PROJECT_ID` | `azfzhbxyxnfqvjehemus` |
| `PRODUCTION_DB_PASSWORD` | Database password for sanctuary-prod |

After secrets are set, merging migration/function changes to `main` runs `supabase db push` + `functions deploy` against prod. Vercel still builds the frontend from the same push.

CI connects via the **session pooler** (IPv4). Direct `db.<ref>.supabase.co` is IPv6-only and fails on GitHub Actions.

### Local Supabase CLI (DEV only)

```bash
npm run supabase:link      # link CLI to Sanctuary DEV
npm run db:push            # apply new migrations to DEV
npm run functions:deploy   # deploy edge functions to DEV
```

## Supabase setup

1. Create a Free Supabase project (use **Sanctuary** for local; **sanctuary-prod** for production).
2. Add `DATABASE_URL` + create an Auth user and set `SEED_USER_ID` in `.env.local` (DEV values).
3. Run `npm run db:setup` (applies migration + TOSC seed on DEV).
4. Confirm the `powersync` publication exists (created by the migration).
5. Expose tables to the Data API if your project defaults to restricted public schema (needed for PowerSync `uploadData` via supabase-js).

Manual SQL files remain under `supabase/migrations/` and `supabase/seed.sql` if you prefer the dashboard.

For ongoing schema work after the first setup, prefer `npm run db:push` (tracks migrations via the CLI) over re-running `db:setup`.

## PowerSync setup

1. Create a PowerSync instance connected to the Supabase Postgres database.
2. **Client Auth:** enable **Use Supabase Auth**, then set **JWKS URI** to:

   `https://<PROJECT_REF>.supabase.co/auth/v1/.well-known/jwks.json`

   (Replace `<PROJECT_REF>` with your project ref, e.g. from `VITE_SUPABASE_URL`.)  
   Click **Save and Deploy**.

3. **Sync Streams** (required — Health will stay empty until this is done):
   - Open **Sync Streams** in the sidebar
   - Paste the contents of `powersync/sync-streams.yaml`
   - Click **Validate**, then **Deploy**

4. Click **Connect** in the top bar → copy the instance URL into `VITE_POWERSYNC_URL`, then restart `npm run dev`.

## Cloudflare R2 setup

1. Create a bucket for animal photos.
2. Configure CORS on the bucket (required for browser uploads). In Cloudflare R2 → bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "http://127.0.0.1:5173"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add your production origin to `AllowedOrigins` when you deploy the PWA.

3. Create an R2 API token with Object Read & Write.
4. Set Edge Function secrets (not Vite env):

| Secret | Example |
|--------|---------|
| `R2_ACCESS_KEY_ID` | token access key |
| `R2_SECRET_ACCESS_KEY` | token secret |
| `R2_BUCKET` | `sanctuary` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (no bucket path) |
| `R2_PUBLIC_BASE_URL` | `https://pub-xxxxx.r2.dev` or custom domain |

5. Set `VITE_R2_PUBLIC_BASE_URL` to the same **public** base (r2.dev / custom domain). Do **not** use `*.r2.cloudflarestorage.com/...` — that is the private S3 API host.

Photo deletes (single photo or remove animal) call the `r2-sign` edge function with `action: "delete"`, which removes the object in R2 on the server. No extra CORS methods are required for deletes.

6. Redeploy after secret or function changes:

```bash
# DEV (local) — always use the npm script
npm run functions:deploy

# PROD — merge to main (GitHub Action). Do not deploy prod from your laptop.
```

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
