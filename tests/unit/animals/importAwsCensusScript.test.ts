import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const privateImportOutput =
  /Mona|Kit|monia|child|Nope|AWS-|cdn\.example|https:\/\/|postgres:\/\/|postgresql:\/\/|127\.0\.0\.1|white|black ear|Rabies|census-secret|secret-pass|Animal Welfare/

const deadDatabaseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_PROD_URL: 'postgres://census-secret:secret-pass@127.0.0.1:1/postgres',
  SUPABASE_DB_URL: 'postgres://census-secret:secret-pass@127.0.0.1:1/postgres',
  DATABASE_URL: 'postgres://census-secret:secret-pass@127.0.0.1:1/postgres',
  POSTGRES_URL: 'postgres://census-secret:secret-pass@127.0.0.1:1/postgres',
}

function runImport(args: string[], env: NodeJS.ProcessEnv = deadDatabaseEnv) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/import-aws-census.mjs', ...args],
    { encoding: 'utf8', env, timeout: 8000 },
  )
}

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

  it('dry-run ignores an organization id and does not print it', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const organizationId = '11111111-1111-4111-8111-111111111111'
    const result = runImport(['--csv', csv, '--organization-id', organizationId])
    expect(result.status).toBe(0)
    expect(result.stdout.trim().split('\n')).toEqual([
      'Mode: dry-run',
      'Animals to import: 5',
      'Skipped: 1',
      'Skipped blank_name: 1',
    ])
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(organizationId)
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(privateImportOutput)
  })

  it('refuses apply without an organization id before opening a connection', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const result = runImport(['--csv', csv, '--apply'])
    expect(result.status).toBe(1)
    expect(result.stdout.trim().split('\n')).toEqual([
      'Mode: apply',
      'Animals to import: 5',
      'Skipped: 1',
      'Skipped blank_name: 1',
    ])
    expect(result.stderr.trim()).toBe('Missing --organization-id')
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(privateImportOutput)
  })

  it('refuses apply when the organization id is not a UUID and does not echo it', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const organizationId = 'not-a-uuid'
    const result = runImport(['--csv', csv, '--apply', '--organization-id', organizationId])
    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe('--organization-id must be a UUID')
    const combined = `${result.stdout}\n${result.stderr}`
    expect(combined).not.toContain(organizationId)
    expect(combined).not.toMatch(privateImportOutput)
  })

  it('refuses a UUID with a bad variant before opening a connection', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const organizationId = '11111111-1111-4111-1111-111111111111'
    const result = runImport(['--csv', csv, '--apply', '--organization-id', `  ${organizationId}  `])
    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe('--organization-id must be a UUID')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(organizationId)
  })

  it('apply with a UUID still fails closed when no connection string is set', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const organizationId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'
    const env = { ...process.env }
    for (const key of ['DATABASE_PROD_URL', 'SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL']) {
      delete env[key]
    }
    const result = runImport(['--csv', csv, '--apply', '--organization-id', organizationId], env)
    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe(
      'No database connection string found in the environment or .env.local',
    )
    const combined = `${result.stdout}\n${result.stderr}`
    expect(combined).not.toContain(organizationId)
    expect(combined).not.toMatch(/Animal Welfare|AWS LUMS/)
  })

  it('does not print the database url when apply cannot connect', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const organizationId = '11111111-1111-4111-8111-111111111111'
    const result = runImport(['--csv', csv, '--apply', '--organization-id', organizationId])
    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe('Import failed')
    const combined = `${result.stdout}\n${result.stderr}`
    expect(combined).not.toContain(organizationId)
    expect(combined).not.toMatch(privateImportOutput)
  })

  it('apply with nothing to import still requires an organization id and does not connect', () => {
    const csv = path.join(mkdtempSync(path.join(tmpdir(), 'census-')), 'empty.csv')
    writeFileSync(
      csv,
      'Name,Picture,Marking,Age,Sex,Rabies Vaccination,Calci/FPV Vaccination,Neutered/Spayed\n',
    )
    const missing = runImport(['--csv', csv, '--apply'])
    expect(missing.status).toBe(1)
    expect(missing.stderr.trim()).toBe('Missing --organization-id')
    expect(missing.stdout).not.toContain('Imported:')

    const organizationId = '11111111-1111-4111-8111-111111111111'
    const ready = runImport(['--csv', csv, '--apply', '--organization-id', organizationId])
    expect(ready.status).toBe(0)
    expect(ready.stdout.trim().split('\n')).toEqual([
      'Mode: apply',
      'Animals to import: 0',
      'Skipped: 0',
      'Imported: 0',
    ])
    expect(`${ready.stdout}\n${ready.stderr}`).not.toContain(organizationId)
    expect(`${ready.stdout}\n${ready.stderr}`).not.toMatch(privateImportOutput)
  })
})
