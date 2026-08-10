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
 * Why DATABASE_URL (not VITE_SUPABASE_*):
 *   Publishable/anon keys talk to the Data API with RLS — they cannot CREATE TABLE
 *   or run migrations. Schema setup needs a direct Postgres connection.
 *
 * Safe to re-run: skips migrate if `organizations` already exists;
 * seed finds-or-creates the org by name and fills missing statuses/categories.
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

const ORG_NAME = 'Tales of Second Chances'
const ORG_INITIALS = 'TOSC'

if (!databaseUrl) {
  console.error(`
Missing DATABASE_URL.

VITE_SUPABASE_URL + publishable/anon key are for the app (login, API, RLS).
They cannot create tables. db:setup needs a Postgres URI:

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

async function applyMigration(filename) {
  const migrationPath = resolve(root, 'supabase/migrations', filename)
  const migrationSql = readFileSync(migrationPath, 'utf8')
  console.log(`→ Applying supabase/migrations/${filename} …`)
  await sql.unsafe(migrationSql)
  console.log(`✓ ${filename} applied`)
}

async function migrate() {
  if (!(await tableExists('organizations'))) {
    await applyMigration('001_initial_schema.sql')
  } else {
    console.log('✓ Schema already present — skipping 001_initial_schema.sql')
  }

  if (!(await tableExists('ledger_attachments'))) {
    await applyMigration('20260810110956_ledger_attachments.sql')
  } else {
    console.log('✓ ledger_attachments already present — skipping attachments migration')
  }

  const anonCol = await sql`
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ledger_entries'
      and column_name = 'is_anonymous'
    limit 1
  `
  if (anonCol.length === 0) {
    await applyMigration('20260810120311_ledger_entry_anonymous.sql')
  } else {
    console.log('✓ is_anonymous already present — skipping anonymous migration')
  }

  const logoCol = await sql`
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'logo_r2_key'
    limit 1
  `
  if (logoCol.length === 0) {
    await applyMigration('004_org_partner_logo.sql')
  } else {
    console.log('✓ logo_r2_key already present — skipping partner logo migration')
  }
}

async function seed() {
  const users = await sql`
    select id from auth.users where id = ${seedUserId}::uuid limit 1
  `
  if (users.length === 0) {
    throw new Error(
      `No auth.users row for SEED_USER_ID=${seedUserId}. Create the user in Supabase Auth first.`,
    )
  }

  console.log(`→ Seeding ${ORG_NAME} …`)

  let orgRows = await sql`
    select id from organizations
    where name = ${ORG_NAME} or initials = ${ORG_INITIALS}
    limit 1
  `

  if (orgRows.length === 0) {
    orgRows = await sql`
      insert into organizations (name, initials)
      values (${ORG_NAME}, ${ORG_INITIALS})
      returning id
    `
  }

  const orgId = orgRows[0].id
  console.log(`  org id: ${orgId}`)

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
