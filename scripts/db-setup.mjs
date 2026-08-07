#!/usr/bin/env node
/**
 * Apply Sanctuary schema + TOSC seed to Supabase Postgres.
 *
 * Requires in .env.local (or env):
 *   DATABASE_URL   — Postgres URI from Supabase → Project Settings → Database
 *   SEED_USER_ID   — auth.users UUID for the pilot admin (create user in dashboard first)
 *
 * Usage:
 *   npm run db:setup
 *
 * Safe to re-run: skips migrate if `organizations` already exists;
 * seed uses ON CONFLICT so duplicate inserts are ignored.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { loadEnvFiles } from './load-env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

loadEnvFiles(root)

const databaseUrl = process.env.DATABASE_URL
const seedUserId = process.env.SEED_USER_ID

if (!databaseUrl) {
  console.error(`
Missing DATABASE_URL.

1. Supabase → Project Settings → Database → Connection string (URI)
2. Replace [YOUR-PASSWORD] with your database password
3. Add to .env.local:

   DATABASE_URL=postgresql://postgres....supabase.co:5432/postgres
`)
  process.exit(1)
}

if (!seedUserId) {
  console.error(`
Missing SEED_USER_ID.

1. Supabase → Authentication → Users → Add user (email/password)
2. Copy that user's UUID
3. Add to .env.local:

   SEED_USER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
`)
  process.exit(1)
}

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
if (!uuidRe.test(seedUserId)) {
  console.error('SEED_USER_ID must be a valid UUID.')
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5 })

async function tableExists(name) {
  const rows = await sql`
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = ${name}
    limit 1
  `
  return rows.length > 0
}

async function migrate() {
  if (await tableExists('organizations')) {
    console.log('✓ Schema already present — skipping migrate')
    return
  }

  const migrationPath = resolve(
    root,
    'supabase/migrations/001_initial_schema.sql',
  )
  const migrationSql = readFileSync(migrationPath, 'utf8')
  console.log('→ Applying supabase/migrations/001_initial_schema.sql …')
  await sql.unsafe(migrationSql)
  console.log('✓ Migration applied')
}

async function seed() {
  const orgId = '11111111-1111-1111-1111-111111111111'

  // Confirm auth user exists
  const users = await sql`
    select id from auth.users where id = ${seedUserId}::uuid limit 1
  `
  if (users.length === 0) {
    throw new Error(
      `No auth.users row for SEED_USER_ID=${seedUserId}. Create the user in Supabase Auth first.`,
    )
  }

  console.log('→ Seeding Tales of Second Chances …')

  await sql`
    insert into organizations (id, name, initials)
    values (${orgId}::uuid, 'Tales of Second Chances', 'TOSC')
    on conflict (id) do nothing
  `

  await sql`
    insert into org_members (org_id, user_id, role)
    values (${orgId}::uuid, ${seedUserId}::uuid, 'admin')
    on conflict (org_id, user_id) do nothing
  `

  const statuses = [
    ['Intake', 1, true],
    ['Quarantine', 2, true],
    ['Treatment', 3, true],
    ['In sanctuary', 4, true],
    ['Transferred', 5, false],
    ['Deceased', 6, false],
    ['Adopted', 7, false],
  ]

  for (const [label, sortOrder, inCare] of statuses) {
    const existing = await sql`
      select 1 from animal_statuses
      where org_id = ${orgId}::uuid and label = ${label}
      limit 1
    `
    if (existing.length === 0) {
      await sql`
        insert into animal_statuses (org_id, label, sort_order, counts_as_in_care)
        values (${orgId}::uuid, ${label}, ${sortOrder}, ${inCare})
      `
    }
  }

  const categories = [
    ['Donation', 'in'],
    ['Medical', 'out'],
    ['Food', 'out'],
    ['Supplies', 'out'],
  ]

  for (const [label, direction] of categories) {
    const existing = await sql`
      select 1 from ledger_categories
      where org_id = ${orgId}::uuid and label = ${label}
      limit 1
    `
    if (existing.length === 0) {
      await sql`
        insert into ledger_categories (org_id, label, direction)
        values (${orgId}::uuid, ${label}, ${direction})
      `
    }
  }

  console.log('✓ Seed complete (org TOSC, admin membership, statuses, categories)')
}

try {
  await migrate()
  await seed()
  console.log('\nDone. You can log in with the seeded user and run: npm run dev')
} catch (err) {
  console.error('\ndb:setup failed:', err.message ?? err)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
