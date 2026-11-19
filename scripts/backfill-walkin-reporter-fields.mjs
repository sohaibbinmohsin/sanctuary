#!/usr/bin/env node
/**
 * Backfill reporter_name / reporter_phone on walk-in (and legacy direct_intake)
 * rescue reports that lost those fields after the animal-link partial update bug.
 *
 * Recovery source: the "Reporter: {name} ({phone})" line written into animal notes
 * (and mirrored onto arrived/intake treatment notes) by createAnimalFromRescueReport.
 * CNIC is not present in those notes and is never invented — rows still missing
 * CNIC are flagged for manual follow-up.
 *
 * Idempotent: only fills reporter_name / reporter_phone when the report column is
 * currently null or empty AND a parseable value was found in notes.
 *
 * Usage:
 *   node scripts/backfill-walkin-reporter-fields.mjs           # Dry-run (counts only)
 *   node scripts/backfill-walkin-reporter-fields.mjs --apply   # Write recoverable fields
 *
 * Do not run --apply against production without Commander review.
 */

import postgres from 'postgres'
import { loadEnvFiles } from './load-env.mjs'

/**
 * Matches "Reporter: Name" or "Reporter: Name (phone)" written at animal creation.
 * Keep in sync with src/features/reports/domain/reporterNotes.ts
 */
export function parseReporterFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null
  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!/^Reporter:/i.test(line)) continue
    const withPhone = line.match(/^Reporter:\s*(.+?)\s*\(([^)]+)\)\s*$/i)
    if (withPhone) {
      const name = withPhone[1].trim()
      const phone = withPhone[2].trim()
      if (name) return { name, phone: phone || null }
    }
    const nameOnly = line.match(/^Reporter:\s*(.+?)\s*$/i)
    if (nameOnly) {
      const name = nameOnly[1].trim()
      if (name) return { name, phone: null }
    }
  }
  return null
}

function isBlank(value) {
  return value == null || String(value).trim() === ''
}

function redactSample(reportNumber, shelterCode, recovered) {
  return {
    report_number: reportNumber || '(unknown)',
    animal: shelterCode || '(unknown)',
    recovered_name: recovered?.name ? '[redacted]' : null,
    recovered_phone: recovered?.phone ? '[redacted]' : null,
  }
}

function getConnectionString() {
  const raw =
    process.env.DATABASE_PROD_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!raw) return null

  if (raw.includes('db.azfzhbxyxnfqvjehemus.supabase.co')) {
    const u = new URL(raw)
    return `postgres://${encodeURIComponent(u.username)}.azfzhbxyxnfqvjehemus:${encodeURIComponent(u.password)}@aws-0-ap-southeast-2.pooler.supabase.com:5432${u.pathname}`
  }

  return raw
}

async function main() {
  loadEnvFiles()

  const connectionString = getConnectionString()
  if (!connectionString) {
    console.error('Error: No database connection string found in environment or .env.local')
    process.exit(1)
  }

  const isApply = process.argv.includes('--apply')
  const isSsl = connectionString.includes('supabase')
  const sql = postgres(connectionString, { max: 2, ssl: isSsl ? 'require' : false })

  console.log(`\n========================================`)
  console.log(`Backfill walk-in reporter name / phone`)
  console.log(`Mode: ${isApply ? 'APPLY (writing to DB)' : 'DRY-RUN (preview only)'}`)
  console.log(`========================================\n`)

  const rows = await sql`
    SELECT
      r.id AS report_id,
      r.report_number,
      r.intake_source,
      r.reporter_name,
      r.reporter_phone,
      r.reporter_cnic,
      r.animal_id,
      a.shelter_code,
      a.notes AS animal_notes,
      (
        SELECT t.notes
        FROM public.treatments t
        WHERE t.animal_id = a.id
          AND t.treatment_type IN ('arrived', 'intake')
          AND t.notes IS NOT NULL
          AND t.notes <> ''
        ORDER BY t.treated_at ASC NULLS LAST, t.created_at ASC NULLS LAST
        LIMIT 1
      ) AS treatment_notes
    FROM public.rescue_reports r
    INNER JOIN public.animals a ON a.id = r.animal_id
    WHERE r.intake_source IN ('walk_in', 'direct_intake')
      AND r.animal_id IS NOT NULL
      AND (
        r.reporter_name IS NULL OR btrim(r.reporter_name) = ''
        OR r.reporter_phone IS NULL OR btrim(r.reporter_phone) = ''
        OR r.reporter_cnic IS NULL OR btrim(r.reporter_cnic) = ''
      )
    ORDER BY r.created_at DESC NULLS LAST
  `

  console.log(`Candidate reports (walk-in/direct with empty reporter field(s)): ${rows.length}\n`)

  let recoverableName = 0
  let recoverablePhone = 0
  let unrecoverableNamePhone = 0
  let cnicStillEmpty = 0
  let wouldUpdate = 0
  const updates = []
  const redactedSamples = []

  for (const row of rows) {
    const parsed =
      parseReporterFromNotes(row.animal_notes) || parseReporterFromNotes(row.treatment_notes)

    const nameMissing = isBlank(row.reporter_name)
    const phoneMissing = isBlank(row.reporter_phone)
    const cnicMissing = isBlank(row.reporter_cnic)

    if (cnicMissing) cnicStillEmpty++

    const nextName = nameMissing && parsed?.name ? parsed.name : null
    const nextPhone = phoneMissing && parsed?.phone ? parsed.phone : null

    if (nextName) recoverableName++
    if (nextPhone) recoverablePhone++

    if ((nameMissing || phoneMissing) && !parsed) {
      unrecoverableNamePhone++
    }

    if (nextName || nextPhone) {
      wouldUpdate++
      updates.push({
        id: row.report_id,
        reporter_name: nextName,
        reporter_phone: nextPhone,
      })
      if (redactedSamples.length < 5) {
        redactedSamples.push(redactSample(row.report_number, row.shelter_code, parsed))
      }
    }
  }

  console.log('Counts:')
  console.log(`  Candidates:                    ${rows.length}`)
  console.log(`  Name recoverable from notes:   ${recoverableName}`)
  console.log(`  Phone recoverable from notes:  ${recoverablePhone}`)
  console.log(`  Reports that would be updated: ${wouldUpdate}`)
  console.log(`  Name/phone not in notes:       ${unrecoverableNamePhone}`)
  console.log(`  CNIC still empty (flagged):    ${cnicStillEmpty}`)
  console.log(`  (CNIC cannot be recovered from intake notes — leave empty)\n`)

  if (redactedSamples.length > 0) {
    console.log('Redacted sample of recoverable rows:')
    for (const sample of redactedSamples) {
      console.log(
        `  - ${sample.report_number} ↔ ${sample.animal}: name=${sample.recovered_name}, phone=${sample.recovered_phone}`,
      )
    }
    console.log('')
  }

  if (isApply && updates.length > 0) {
    console.log('Applying recoverable name/phone updates...')
    let applied = 0
    const batchSize = 50
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      await sql.begin(async (tx) => {
        for (const item of batch) {
          // Idempotent: only fill blank columns; never overwrite existing values; never invent CNIC.
          await tx`
            UPDATE public.rescue_reports
            SET
              reporter_name = CASE
                WHEN (reporter_name IS NULL OR btrim(reporter_name) = '') AND ${item.reporter_name}::text IS NOT NULL
                  THEN ${item.reporter_name}
                ELSE reporter_name
              END,
              reporter_phone = CASE
                WHEN (reporter_phone IS NULL OR btrim(reporter_phone) = '') AND ${item.reporter_phone}::text IS NOT NULL
                  THEN ${item.reporter_phone}
                ELSE reporter_phone
              END,
              updated_at = NOW()
            WHERE id = ${item.id}
              AND (
                (
                  (reporter_name IS NULL OR btrim(reporter_name) = '')
                  AND ${item.reporter_name}::text IS NOT NULL
                )
                OR (
                  (reporter_phone IS NULL OR btrim(reporter_phone) = '')
                  AND ${item.reporter_phone}::text IS NOT NULL
                )
              )
          `
          applied++
        }
      })
      process.stdout.write(
        `  Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length} reports...\r`,
      )
    }
    console.log(`\nApplied updates for ${applied} report(s). CNIC left empty where missing.\n`)
  } else if (!isApply && wouldUpdate > 0) {
    console.log('Dry-run only. To apply after Commander review:')
    console.log('  node scripts/backfill-walkin-reporter-fields.mjs --apply\n')
  } else if (wouldUpdate === 0) {
    console.log('Nothing to update.\n')
  }

  await sql.end()
}

const invokedPath = process.argv[1] || ''
if (invokedPath.endsWith('backfill-walkin-reporter-fields.mjs')) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
