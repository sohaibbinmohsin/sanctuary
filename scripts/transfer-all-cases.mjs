#!/usr/bin/env node
/**
 * Migration Script: Mark all historical cases and animals as Transferred.
 *
 * Rules:
 * - Status: 'Transferred'
 * - Transfer Date: Exactly 1 week (7 days) after the intake date at 3:00 PM (15:00)
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

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL

if (!connectionString) {
  console.error('Error: No DATABASE_URL found in environment or .env.local')
  process.exit(1)
}

const isApply = process.argv.includes('--apply')
const sql = postgres(connectionString, { max: 2 })

function calculateTransferDate(intakeDateOrCreatedAt) {
  const base = new Date(intakeDateOrCreatedAt)
  if (isNaN(base.getTime())) return new Date().toISOString()

  // Add 7 days
  const target = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)
  // Set to 3:00 PM local time (15:00:00)
  target.setUTCHours(10, 0, 0, 0) // 10:00 UTC = 15:00 (3:00 PM) Pakistan Standard Time (PKT)
  return target.toISOString()
}

async function main() {
  console.log(`\n========================================`)
  console.log(`🐾 Mark Cases & Animals as Transferred`)
  console.log(`Mode: ${isApply ? '🚀 APPLY (Writing to DB)' : '👀 DRY-RUN (Preview only)'}`)
  console.log(`========================================\n`)

  // 1. Locate the 'Transferred' status ID
  const statuses = await sql`
    SELECT id, org_id, label, counts_as_in_care
    FROM public.animal_statuses
    WHERE LOWER(label) = 'transferred'
    LIMIT 1
  `

  if (!statuses || statuses.length === 0) {
    console.error('❌ Could not find "Transferred" status in animal_statuses table.')
    await sql.end()
    process.exit(1)
  }

  const transferredStatus = statuses[0]
  console.log(`Found Status: "${transferredStatus.label}" (ID: ${transferredStatus.id})\n`)

  // 2. Fetch all animals
  const animals = await sql`
    SELECT id, org_id, name, intake_date, status_id, created_at
    FROM public.animals
    ORDER BY created_at ASC
  `

  console.log(`Found ${animals.length} total animal profile(s).`)

  for (const animal of animals) {
    const intakeBase = animal.intake_date || animal.created_at
    const transferTimestamp = calculateTransferDate(intakeBase)
    const animalName = animal.name || animal.id.slice(0, 8)

    console.log(`  👉 Animal [${animalName}]: intake ${new Date(intakeBase).toLocaleDateString()} -> transferred at ${transferTimestamp} (3:00 PM PKT)`)

    if (isApply) {
      // Update animal status
      await sql`
        UPDATE public.animals
        SET status_id = ${transferredStatus.id},
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

  // 3. Fetch all rescue reports
  const reports = await sql`
    SELECT id, org_id, animal_id, status, disposition_type, stage_logged_at, created_at
    FROM public.rescue_reports
    ORDER BY created_at ASC
  `

  console.log(`\nFound ${reports.length} total rescue report(s).`)

  for (const report of reports) {
    const intakeBase = report.stage_logged_at || report.created_at
    const transferTimestamp = calculateTransferDate(intakeBase)

    console.log(`  👉 Report [${report.id.slice(0, 8)}]: set disposition_type = 'transferred_partner', stage_attended_at = ${transferTimestamp}`)

    if (isApply) {
      await sql`
        UPDATE public.rescue_reports
        SET status = 'attended',
            disposition_type = 'transferred_partner',
            stage_attended_at = COALESCE(stage_attended_at, ${transferTimestamp}),
            updated_at = NOW()
        WHERE id = ${report.id}
      `
    }
  }

  console.log(`\n----------------------------------------`)
  if (!isApply) {
    console.log(`💡 DRY-RUN complete. No data was modified.`)
    console.log(`   To apply these updates to the database, run:`)
    console.log(`   node scripts/transfer-all-cases.mjs --apply\n`)
  } else {
    console.log(`✨ Successfully updated ${animals.length} animals and ${reports.length} reports to Transferred!\n`)
  }

  await sql.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
