import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('import-aws-census script', () => {
  it('dry-runs the sample without a database and without photos', () => {
    const csv = path.resolve('tests/fixtures/aws-census-sample.csv')
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/import-aws-census.mjs', '--csv', csv],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(0)
    const out = result.stdout
    expect(out).toContain('AWS-0001 | Mona | Cat | adult | Female | 5 years | sterilized Unknown | vaccines Rabies')
    expect(out).toContain('AWS-0002 | Kit | Cat | adult | Male | 8 months | sterilized No | vaccines Calci/FPV')
    expect(out).toContain('row 3: monia + child')
    expect(out).toContain('row 5: blank name')
    expect(out).toContain('row 6: Nope: unparsed age')
    expect(out).toContain('DRY-RUN')
    expect(out).not.toContain('cdn.example')
    expect(out).not.toContain('https://')
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