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

const COMMON_AREA_ALIASES = {
  thoker: 'Thokar Niaz Baig',
  thokhar: 'Thokar Niaz Baig',
  thokr: 'Thokar Niaz Baig',
  'daewo express thoker': 'Thokar Niaz Baig',
  margzar: 'Marghzar Colony',
  'green twon': 'Green Town',
  'bank stop': { lat: 31.4803, lng: 74.3602, name: 'Bank Stop (Walton Road)' },
}

function getCentroid(areaName, cityName) {
  if (!areaName || !areaName.trim()) return null
  const qLower = areaName.trim().toLowerCase()

  const directAlias = COMMON_AREA_ALIASES[qLower]
  if (directAlias && typeof directAlias === 'object') {
    return {
      latitude: directAlias.lat,
      longitude: directAlias.lng,
      matchedArea: directAlias.name,
    }
  }

  const lookupName = typeof directAlias === 'string' ? directAlias : areaName
  const cityId = cityName ? cityName.trim().toLowerCase().replace(/[\s_]+/g, '-') : undefined
  const matches = searchAreas(lookupName, { cityId, limit: 5 })
  const targetLower = lookupName.trim().toLowerCase()

  for (const top of matches) {
    const isExact = top.name.toLowerCase() === targetLower
    const isAlias = (top.aliases || []).some((a) => a.toLowerCase() === targetLower)
    const isPrefix = top.name.toLowerCase().startsWith(targetLower) || targetLower.startsWith(top.name.toLowerCase())
    if (isExact || isAlias || isPrefix) {
      return {
        latitude: top.coordinates.lat,
        longitude: top.coordinates.lng,
        matchedArea: top.name,
      }
    }
  }
  return null
}

async function main() {
  console.log(`\n========================================`)
  console.log(`📍 Backfill Report GPS Coordinates`)
  console.log(`Mode: ${isApply ? '🚀 APPLY (Writing to DB)' : '👀 DRY-RUN (Preview only)'}`)
  console.log(`========================================\n`)

  const rows = await sql`
    SELECT id, location_area, city, latitude, longitude
    FROM public.rescue_reports
    WHERE latitude IS NULL AND location_area IS NOT NULL AND location_area != ''
    ORDER BY created_at DESC
  `

  console.log(`Found ${rows.length} reports with missing coordinates.\n`)

  let matched = 0
  let unmatched = 0
  const updates = []

  for (const row of rows) {
    const area = row.location_area?.trim()
    const city = row.city?.trim() || 'Lahore'
    const centroid = getCentroid(area, city)

    if (centroid) {
      matched++
      updates.push({
        id: row.id,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
      })
    } else {
      unmatched++
    }
  }

  console.log(`Matched against pak-geodata: ${matched} reports`)
  console.log(`Unmatched (no centroid yet):  ${unmatched} reports`)

  if (isApply && updates.length > 0) {
    console.log(`\nApplying updates in batches to database...`)
    const batchSize = 100
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      await sql.begin(async (tx) => {
        for (const item of batch) {
          await tx`
            UPDATE public.rescue_reports
            SET latitude = ${item.latitude},
                longitude = ${item.longitude},
                updated_at = NOW()
            WHERE id = ${item.id}
          `
        }
      })
      process.stdout.write(`  Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length} reports...\r`)
    }
    console.log(`\n✨ Successfully updated ${matched} reports in production!\n`)

    const walkInFixes = await sql`
      UPDATE public.rescue_reports
      SET intake_source = CASE 
            WHEN location_area ILIKE '%1122%' THEN 'rescue_1122'
            ELSE 'walk_in'
          END,
          location_area = NULL,
          updated_at = NOW()
      WHERE latitude IS NULL AND (location_area ILIKE '%1122%' OR location_area = 'Office')
      RETURNING id, report_number, location_area, intake_source
    `
    if (walkInFixes.length > 0) {
      console.log(`🩺 Updated ${walkInFixes.length} 1122/Office reports to walk-in intake source and cleared dummy location area.`)
    }
  } else if (!isApply && matched > 0) {
    console.log(`\n💡 To apply these changes to the database, run:`)
    console.log(`   node scripts/backfill-report-coordinates.mjs --apply\n`)
  }

  await sql.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
