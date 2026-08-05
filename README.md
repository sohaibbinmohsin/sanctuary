# Sanctuary

Shelter management PWA for animal rescues and sanctuaries. Offline-first via PowerSync + Supabase.

## Development

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — type-check and production build
- `npm test` — run Vitest
- `npm run preview` — preview production build

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_POWERSYNC_URL` | PowerSync instance URL |
| `VITE_R2_PUBLIC_BASE_URL` | Cloudflare R2 public base URL for photos |
| `VITE_SUPPORT_EMAIL` | Support contact (default `support@themohsinproject.org`) |

## Supabase setup

1. Create a Free Supabase project.
2. In the SQL editor, run `supabase/migrations/001_initial_schema.sql`.
3. Create the pilot user (Auth → Users → Add user), copy their `user_id`.
4. In `supabase/seed.sql`, replace `:user_id` with that UUID, then run the seed.
5. Confirm the `powersync` publication exists for all tenant tables.

## PowerSync & R2

Configure after installing client sync (see later README sections once Task 4+ land).
