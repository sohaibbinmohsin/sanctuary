import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('import-aws-census script', () => {
  it('dry-runs the sample without a database and without photos', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/import-aws-census.mjs', '--csv', csv],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_PROD_URL: 'postgres://127.0.0.1:1/postgres',
          SUPABASE_DB_URL: 'postgres://127.0.0.1:1/postgres',
          DATABASE_URL: 'postgres://127.0.0.1:1/postgres',
          POSTGRES_URL: 'postgres://127.0.0.1:1/postgres',
        },
      },
    )
    expect(result.status).toBe(0)
    expect(result.stdout.trim().split('\n')).toEqual([
      'Mode: dry-run',
      'Animals to import: 5',
      'Skipped: 1',
      'Skipped blank_name: 1',
    ])
    const combined = `${result.stdout}\n${result.stderr}`
    expect(combined).not.toMatch(/Mona|Kit|monia|child|Nope|AWS-|cdn\.example|https:\/\/|postgres:\/\/|postgresql:\/\/|127\.0\.0\.1|white|black ear|Rabies|Manual splits/)
  })

  it('refuses a bad header without printing the row', () => {
    const csv = path.join(mkdtempSync(path.join(tmpdir(), 'census-')), 'bad.csv')
    writeFileSync(csv, 'Mona,secret medical note\n')
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/import-aws-census.mjs', '--csv', csv],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe('Census CSV header was refused')
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/Mona|secret medical note/)
  })

  it('exits with an error when --csv is missing', () => {
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/import-aws-census.mjs'],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Missing --csv')
  })
})
