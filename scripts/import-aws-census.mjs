#!/usr/bin/env node
/**
 * Import the AWS Cat Census Sheet1 CSV into Animal Welfare Society LUMS.
 *
 * Spreadsheet: 1CWAi4_hm9OTpJruJohew9D7BOFKYbdCXsRNLfCZ2XwA
 * Tab: Sheet1
 * Photos are not imported. Group rows are printed and skipped.
 *
 *   node --experimental-strip-types scripts/import-aws-census.mjs --csv ./census.csv
 *   node --experimental-strip-types scripts/import-aws-census.mjs --csv ./census.csv --apply
 */

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { loadEnvFiles } from './load-env.mjs'
import { formatAgePhrase } from '../src/features/animals/domain/age.ts'
import { sterilizedLabel } from '../src/features/animals/domain/sterilized.ts'
import { vaccineLabel } from '../src/features/treatments/domain/vaccines.ts'
import {
  AWS_LUMS_ORG_NAME,
  assignCensusShelterCodes,
  censusIntakeDate,
  censusTreatedAt,
  parseCensusCsv,
  pickCensusStatusId,
  planCensusImport,
} from '../src/features/animals/domain/censusImport.ts'

loadEnvFiles()

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

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function vaccineText(ids) {
  if (ids.length === 0) return 'none'
  return ids.map((id) => vaccineLabel(id) ?? id).join(', ')
}

function printPlan(writes, plan) {
  console.log(`Animals to import: ${writes.length}`)
  for (const write of writes) {
    const age = formatAgePhrase(write.ageYears, write.ageMonths) ?? 'unknown'
    const sex = write.sex ?? 'Unknown'
    console.log(
      `${write.shelterCode} | ${write.name} | ${write.species} | ${write.lifeStage} | ${sex} | ${age} | sterilized ${sterilizedLabel(write.sterilized)} | vaccines ${vaccineText(write.vaccines)}`,
    )
  }
  console.log('Manual splits (not imported):')
  if (plan.manualSplits.length === 0) console.log('  none')
  for (const split of plan.manualSplits) {
    console.log(`  row ${split.rowNumber}: ${split.name}`)
  }
  console.log('Skipped:')
  if (plan.skipped.length === 0) console.log('  none')
  for (const skip of plan.skipped) {
    if (skip.reason === 'blank_name') {
      console.log(`  row ${skip.rowNumber}: blank name`)
    } else {
      console.log(`  row ${skip.rowNumber}: ${skip.name}: ${skip.reason.replaceAll('_', ' ')}`)
    }
  }
}

async function main() {
  const csvPath = argValue('--csv')
  if (!csvPath) {
    console.error('Missing --csv')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')
  let text
  try {
    text = readFileSync(csvPath, 'utf8')
  } catch (err) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }
  const plan = planCensusImport(parseCensusCsv(text))
  const preview = assignCensusShelterCodes('AWS', [], plan.animals)
  console.log(apply ? 'AWS LUMS census apply' : 'AWS LUMS census dry-run')
  printPlan(preview, plan)
  if (!apply) {
    console.log('DRY-RUN')
    return
  }
  if (preview.length === 0) {
    console.log('No animals to import.')
    return
  }

  const connectionString = getConnectionString()
  if (!connectionString) {
    console.error('No database connection string found in the environment or .env.local')
    process.exit(1)
  }
  const sql = postgres(connectionString, {
    max: 1,
    ssl: connectionString.includes('supabase') ? 'require' : false,
  })
  try {
    const orgs = await sql`
      select id, name, initials
      from organizations
      where lower(btrim(name)) = lower(btrim(${AWS_LUMS_ORG_NAME}))
    `
    if (orgs.length !== 1) {
      console.error(
        `Expected one organization named ${AWS_LUMS_ORG_NAME}. Found ${orgs.length}.`,
      )
      process.exit(1)
    }
    const org = orgs[0]
    if (!org.initials || !String(org.initials).trim()) {
      console.error('AWS LUMS organization has no initials.')
      process.exit(1)
    }
    const statuses = await sql`
      select id, label, counts_as_in_care, archived
      from animal_statuses
      where org_id = ${org.id}
    `
    const statusId = pickCensusStatusId(statuses)
    if (!statusId) {
      console.error('AWS LUMS has no animal status to assign.')
      process.exit(1)
    }
    const codeRows = await sql`
      select shelter_code from animals where org_id = ${org.id}
    `
    const writes = assignCensusShelterCodes(
      String(org.initials).trim(),
      codeRows.map((row) => row.shelter_code),
      plan.animals,
    )
    const intakeDate = censusIntakeDate(new Date())
    const treatedAt = censusTreatedAt(intakeDate)
    const now = new Date().toISOString()
    const keys = writes.map((write) => write.name.trim().toLowerCase())

    await sql.begin(async (tx) => {
      const existing = await tx`
        select name from animals
        where org_id = ${org.id}
          and archived = false
          and lower(btrim(name)) in ${tx(keys)}
      `
      if (existing.length > 0) {
        const names = existing.map((row) => row.name).join(', ')
        throw new Error(`Census name already in AWS LUMS: ${names}`)
      }
      for (const write of writes) {
        const animalId = randomUUID()
        await tx`
          insert into animals (
            id, org_id, shelter_code, name, species, sex, markings,
            intake_date, status_id, notes, archived, created_at, updated_at,
            life_stage, sterilized, age_years, age_months
          ) values (
            ${animalId}, ${org.id}, ${write.shelterCode}, ${write.name}, ${write.species},
            ${write.sex}, ${write.markings}, ${intakeDate}, ${statusId}, ${null},
            ${false}, ${now}, ${now}, ${write.lifeStage}, ${write.sterilized},
            ${write.ageYears}, ${write.ageMonths}
          )
        `
        await tx`
          insert into treatments (
            id, org_id, animal_id, treated_at, treatment_type, notes,
            ledger_entry_id, hide_from_public, created_at, vaccine
          ) values (
            ${randomUUID()}, ${org.id}, ${animalId}, ${treatedAt}, 'arrived', ${null},
            ${null}, ${false}, ${now}, ${null}
          )
        `
        for (const vaccineId of write.vaccines) {
          await tx`
            insert into treatments (
              id, org_id, animal_id, treated_at, treatment_type, notes,
              ledger_entry_id, hide_from_public, created_at, vaccine
            ) values (
              ${randomUUID()}, ${org.id}, ${animalId}, ${treatedAt}, 'vaccination', ${null},
              ${null}, ${false}, ${now}, ${vaccineId}
            )
          `
        }
      }
    })
    console.log(`Imported ${writes.length} animals into ${org.name}.`)
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})