#!/usr/bin/env node
/**
 * Backfill GPS coordinates and centroid flags for historical rescue reports.
 * Reads reports where latitude IS NULL and location_area IS NOT NULL,
 * matches them against pak-geodata area centroids, and updates the database.
 *
 * Usage:
 *   node scripts/backfill-report-coordinates.mjs           # Dry-run (preview only)
 *   node scripts/backfill-report-coordinates.mjs --apply   # Commit updates to DB
 */

import postgres from 'postgres'
import { searchAreas } from 'pak-geodata'
import { loadEnvFiles } from './load-env.mjs'

loadEnvFiles()

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL

if (!connectionString) {
  console.error('Error: No DATABASE_URL or SUPABASE_DB_URL found in environment or .env.local')
  process.exit(1)
}

const isApply = process.argv.includes('--apply')
const sql = postgres(connectionString, { max: 2 })

function getCentroid(areaName, cityName) {
  if (!areaName || !areaName.trim()) return null
  const cityId = cityName ? cityName.trim().toLowerCase().replace(/[\s_]+/g, '-') : undefined
  const matches = searchAreas(areaName, { cityId, limit: 1 })
  if (matches.length > 0) {
    const top = matches[0]
    return {
      latitude: top.coordinates.lat,
      longitude: top.coordinates.lng,
    }
  }
  return null
}

async function main() {
  console.log(`\n🔍 Scanning rescue_reports with missing coordinates...`)
  console.log(`Mode: ${isApply ? '🚀 APPLY (Writing to DB)' : '👀 DRY-RUN (Preview only)'}\n`)

  const rows = await sql`
    SELECT id, org_id, location_area, city, latitude, longitude
    FROM public.rescue_reports
    WHERE latitude IS NULL AND location_area IS NOT NULL AND location_area != ''
    ORDER BY created_at DESC
  `

  console.log(`Found ${rows.length} reports with missing coordinates.\n`)

  let matched = 0
  let unmatched = 0

  for (const row of rows) {
    const area = row.location_area?.trim()
    const city = row.city?.trim() || 'Lahore'
    const centroid = getCentroid(area, city)

    if (centroid) {
      matched++
      console.log(`  ✅ [${row.id.slice(0, 8)}] "${area}" (${city}) -> ${centroid.latitude}, ${centroid.longitude}`)
      if (isApply) {
        await sql`
          UPDATE public.rescue_reports
          SET latitude = ${centroid.latitude},
              longitude = ${centroid.longitude},
              updated_at = NOW()
          WHERE id = ${row.id}
        `
      }
    } else {
      unmatched++
      console.log(`  ⚠️  [${row.id.slice(0, 8)}] "${area}" (${city}) -> No pak-geodata centroid match`)
    }
  }

  console.log(`\n----------------------------------------`)
  console.log(`Total analyzed: ${rows.length}`)
  console.log(`Matched:        ${matched}`)
  console.log(`Unmatched:      ${unmatched}`)

  if (!isApply && matched > 0) {
    console.log(`\n💡 To apply these changes to the database, run:`)
    console.log(`   node scripts/backfill-report-coordinates.mjs --apply\n`)
  } else if (isApply) {
    console.log(`\n✨ Successfully updated ${matched} reports in the database!\n`)
  }

  await sql.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
