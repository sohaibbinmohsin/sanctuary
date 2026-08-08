#!/usr/bin/env node
/**
 * Run Supabase CLI commands against the DEV project only.
 *
 * Production is deployed exclusively by GitHub Actions on push to main.
 * This wrapper always injects --project-ref for Sanctuary (dev) and refuses
 * the production ref so local work cannot accidentally hit sanctuary-prod.
 *
 * Usage:
 *   node scripts/supabase-dev.mjs link
 *   node scripts/supabase-dev.mjs db push
 *   node scripts/supabase-dev.mjs functions deploy
 *   node scripts/supabase-dev.mjs functions deploy r2-sign
 */

import { spawnSync } from 'node:child_process'

/** Sanctuary (development) — local npm scripts always use this. */
const DEV_PROJECT_REF = 'nsplqqaihekmmfznbkzb'
/** sanctuary-prod — CI only; never pass this from local scripts. */
const PROD_PROJECT_REF = 'azfzhbxyxnfqvjehemus'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error(`Usage: node scripts/supabase-dev.mjs <supabase-cli-args…>

Always targets DEV (${DEV_PROJECT_REF}). Production is GitHub Actions only.`)
  process.exit(1)
}

const joined = args.join(' ')
if (joined.includes(PROD_PROJECT_REF)) {
  console.error(
    `Refusing to run against production (${PROD_PROJECT_REF}).\n` +
      `Local commands use DEV only. Prod deploys via .github/workflows/supabase-production.yml.`,
  )
  process.exit(1)
}

// Strip any existing --project-ref so we always win with DEV.
const filtered = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-ref') {
    i += 1
    continue
  }
  if (args[i].startsWith('--project-ref=')) continue
  filtered.push(args[i])
}

const cliArgs = [...filtered, '--project-ref', DEV_PROJECT_REF]

console.log(`[supabase-dev] → ${DEV_PROJECT_REF} (Sanctuary DEV)`)
console.log(`[supabase-dev] supabase ${cliArgs.join(' ')}`)

const result = spawnSync('supabase', cliArgs, {
  stdio: 'inherit',
  shell: false,
})

if (result.error) {
  console.error(result.error.message)
  console.error('Is the Supabase CLI installed? https://supabase.com/docs/guides/cli')
  process.exit(1)
}

process.exit(result.status ?? 1)
