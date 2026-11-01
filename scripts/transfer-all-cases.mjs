#!/usr/bin/env node
/**
 * Migration Script: Mark all historical cases and animals as Transferred.
 *
 * Rules:
 * - Status: 'Transferred' (matched per organization)
 * - Transfer Date: Exactly 1 week (7 days) after the intake date at 3:00 PM PKT (10:00 UTC)
 * - Notes: 'Transferred'
 *
 * Usage:
 *   node scripts/transfer-all-cases.mjs          # Preview changes (Dry-run)
 *   node scripts/transfer-all-cases.mjs --apply  # Commit changes to DB
 */

import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { loadEnvFiles } from './load-env.mjs'

loadEnvFiles()

function getConnectionString() {
  const raw =
    process.env.DATABASE_PROD_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!raw) return null

  // Route Supabase direct connection through IPv4 pooler if needed
  if (raw.includes('db.azfzhbxyxnfqvjehemus.supabase.co')) {
    const u = new URL(raw)
    return `postgres://${encodeURIComponent(u.username)}.azfzhbxyxnfqvjehemus:${encodeURIComponent(u.password)}@aws-0-ap-southeast-2.pooler.supabase.com:5432${u.pathname}`
  }

  return raw
}

const connectionString = getConnectionString()

if (!connectionString) {
  console.error('Error: No database connection string found in environment or .env.local')
  process.exit(1)
}

const isApply = process.argv.includes('--apply')
const isSsl = connectionString.includes('supabase')
const sql = postgres(connectionString, { max: 2, ssl: isSsl ? 'require' : false })

function calculateTransferDate(intakeDateOrCreatedAt) {
  const base = new Date(intakeDateOrCreatedAt)
  if (isNaN(base.getTime())) return new Date().toISOString()

  // Add 7 days
  const target = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)
  // Set to 3:00 PM PKT (15:00:00 PKT = 10:00:00 UTC)
  target.setUTCHours(10, 0, 0, 0)
  return target.toISOString()
}

async function main() {
  console.log(`\n========================================`)
  console.log(`🐾 Mark Cases & Animals as Transferred`)
  console.log(`Mode: ${isApply ? '🚀 APPLY (Writing to DB)' : '👀 DRY-RUN (Preview only)'}`)
  console.log(`========================================\n`)

  // 1. Fetch all 'Transferred' statuses by org_id
  const statusRows = await sql`
    SELECT id, org_id, label, counts_as_in_care
    FROM public.animal_statuses
    WHERE LOWER(label) = 'transferred'
  `

  const orgStatusMap = new Map()
  for (const s of statusRows) {
    orgStatusMap.set(s.org_id, s.id)
  }

  console.log(`Found Transferred statuses across ${orgStatusMap.size} organizations.`)

  // 2. Fetch all animals
  const animals = await sql`
    SELECT id, org_id, name, intake_date, status_id, created_at
    FROM public.animals
    ORDER BY created_at ASC
  `

  console.log(`Found ${animals.length} total animal profile(s).`)

  let animalsUpdated = 0
  for (const animal of animals) {
    let transferredStatusId = orgStatusMap.get(animal.org_id)

    // Fallback: If org doesn't have a Transferred status, create one
    if (!transferredStatusId) {
      if (isApply) {
        const newId = randomUUID()
        await sql`
          INSERT INTO public.animal_statuses (
            id, org_id, label, sort_order, counts_as_in_care, archived, created_at
          ) VALUES (
            ${newId}, ${animal.org_id}, 'Transferred', 99, false, false, NOW()
          )
        `
        orgStatusMap.set(animal.org_id, newId)
        transferredStatusId = newId
      } else {
        transferredStatusId = 'status-pending-creation'
      }
    }

    const intakeBase = animal.intake_date || animal.created_at
    const transferTimestamp = calculateTransferDate(intakeBase)
    animalsUpdated++

    if (isApply) {
      // Update animal status
      await sql`
        UPDATE public.animals
        SET status_id = ${transferredStatusId},
            updated_at = NOW()
        WHERE id = ${animal.id}
      `

      // Insert timeline entry in treatments
      await sql`
        INSERT INTO public.treatments (
          id,
          org_id,
          animal_id,
          treatment_type,
          notes,
          treated_at,
          created_at,
          hide_from_public
        ) VALUES (
          ${randomUUID()},
          ${animal.org_id},
          ${animal.id},
          'status',
          'Transferred',
          ${transferTimestamp},
          NOW(),
          false
        )
      `
    }
  }

  console.log(`  Processed ${animalsUpdated} animals for status update.`)

  // 3. Fetch all rescue reports
  const reports = await sql`
    SELECT id, org_id, animal_id, status, disposition_type, stage_logged_at, created_at
    FROM public.rescue_reports
    ORDER BY created_at ASC
  `

  console.log(`\nFound ${reports.length} total rescue report(s).`)

  let reportsUpdated = 0
  if (isApply) {
    // Bulk update rescue reports
    const result = await sql`
      UPDATE public.rescue_reports
      SET status = 'attended',
          disposition_type = 'transferred_partner',
          stage_attended_at = COALESCE(
            stage_attended_at,
            (COALESCE(stage_logged_at::date, created_at::date) + INTERVAL '7 days' + TIME '10:00:00')::timestamptz
          ),
          updated_at = NOW()
      WHERE disposition_type IS NULL OR disposition_type != 'transferred_partner'
    `
    reportsUpdated = result.count
  } else {
    reportsUpdated = reports.length
  }

  console.log(`  Processed ${reportsUpdated} rescue reports for transfer disposition.`)

  console.log(`\n----------------------------------------`)
  if (!isApply) {
    console.log(`💡 DRY-RUN complete. No data was modified.`)
    console.log(`   To apply these updates to the production database, run:`)
    console.log(`   node scripts/transfer-all-cases.mjs --apply\n`)
  } else {
    console.log(`✨ Successfully updated ${animalsUpdated} animals and ${reportsUpdated} reports to Transferred in production!\n`)
  }

  await sql.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
