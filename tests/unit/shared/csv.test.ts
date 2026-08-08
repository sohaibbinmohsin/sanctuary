import { describe, it, expect } from 'vitest'
import { animalsToCsv, ledgerToCsv, treatmentsToCsv } from '@/shared/lib/export/csv'

describe('csv export', () => {
  it('escapes quotes and keeps Urdu', () => {
    const csv = animalsToCsv([
      {
        shelter_code: 'TOSC-0001',
        name: 'بلا',
        species: 'cat',
        markings: 'a, b',
        status: 'Intake',
      },
    ])
    expect(csv).toContain('بلا')
    expect(csv).toContain('"a, b"')
    expect(csv.split('\n')[0]).toContain('shelter_code')
  })

  it('escapes embedded quotes in treatments', () => {
    const csv = treatmentsToCsv([
      {
        shelter_code: 'TOSC-0001',
        treated_at: '2026-08-05',
        treatment_type: 'meds',
        notes: 'said "ok"',
      },
    ])
    expect(csv).toContain('"said ""ok"""')
  })

  it('includes ledger amount cents', () => {
    const csv = ledgerToCsv([
      {
        entry_date: '2026-08-05',
        direction: 'out',
        category: 'Food',
        amount_cents: 150000,
        notes: null,
        shelter_code: null,
      },
    ])
    expect(csv).toContain('150000')
  })
})
