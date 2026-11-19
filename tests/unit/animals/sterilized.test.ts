import { describe, expect, it, vi } from 'vitest'
import { createAnimal, updateAnimal } from '@/features/animals/domain/animals'
import {
  sterilizedLabel,
  sterilizedOrUnknown,
} from '@/features/animals/domain/sterilized'
import { updateTreatment } from '@/features/treatments/domain/treatments'
import type { SanctuaryDb } from '@/shared/lib/db'

describe('sterilized helpers', () => {
  it('defaults unknown and labels the three choices', () => {
    expect(sterilizedOrUnknown(null)).toBe('unknown')
    expect(sterilizedOrUnknown(undefined)).toBe('unknown')
    expect(sterilizedOrUnknown('yes')).toBe('yes')
    expect(sterilizedOrUnknown('no')).toBe('no')
    expect(sterilizedOrUnknown('maybe')).toBe('unknown')
    expect(sterilizedLabel('yes')).toBe('Yes')
    expect(sterilizedLabel('no')).toBe('No')
    expect(sterilizedLabel(null)).toBe('Unknown')
  })
})

describe('updateAnimal sterilized', () => {
  it('writes the chosen value', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = {
      execute,
      getOptional: vi.fn().mockResolvedValue({
        id: 'animal-1',
        org_id: 'org-1',
        species: 'Cat',
        sex: 'Female',
        life_stage: 'adult',
        sterilized: 'unknown',
        markings: null,
        intake_date: '2026-11-20',
        notes: null,
        name: 'Mona',
        status_id: 'st-1',
        status_label: 'Intake',
        archived: 0,
      }),
      getAll: vi.fn().mockResolvedValue([]),
    } as unknown as SanctuaryDb

    await updateAnimal(db, 'animal-1', {
      species: 'Cat',
      sex: 'Female',
      sterilized: 'yes',
    })

    const [sql, params] = execute.mock.calls.find(([query]) =>
      String(query).includes('UPDATE animals'),
    )!
    expect(String(sql)).toContain('sterilized')
    expect(params).toContain('yes')
    expect(String(sql)).not.toContain('age_years')
  })

  it('keeps a stored yes when the edit omits sterilized', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = {
      execute,
      getOptional: vi.fn().mockResolvedValue({
        id: 'animal-1',
        org_id: 'org-1',
        species: 'Cat',
        sex: 'Female',
        life_stage: 'adult',
        sterilized: 'yes',
        markings: null,
        intake_date: '2026-11-20',
        notes: null,
        name: 'Mona',
        status_id: 'st-1',
        status_label: 'Intake',
        archived: 0,
      }),
      getAll: vi.fn().mockResolvedValue([]),
    } as unknown as SanctuaryDb

    await updateAnimal(db, 'animal-1', { species: 'Cat', sex: 'Female' })

    const [, params] = execute.mock.calls.find(([query]) =>
      String(query).includes('UPDATE animals'),
    )!
    expect(params).toContain('yes')
  })
})

describe('procedure care does not change sterilized', () => {
  it('never writes the sterilized column', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = {
      execute,
      getOptional: vi.fn().mockResolvedValue({
        id: 'care-1',
        org_id: 'org-1',
        animal_id: 'animal-1',
        treated_at: '2026-11-20T12:00:00.000Z',
        treatment_type: 'procedure',
        notes: 'Spay',
        ledger_entry_id: null,
        hide_from_public: 0,
        created_at: '2026-11-20T12:00:00.000Z',
      }),
      getAll: vi.fn().mockResolvedValue([]),
    } as unknown as SanctuaryDb

    await updateTreatment(db, 'care-1', {
      treatmentType: 'procedure',
      notes: 'Spay surgery',
      treatedAt: '2026-11-20T12:00:00.000Z',
    })

    expect(execute).toHaveBeenCalled()
    for (const [sql] of execute.mock.calls) {
      expect(String(sql).toLowerCase()).not.toContain('sterilized')
    }
  })
})

describe('createAnimal sterilized default', () => {
  it('stores unknown when sterilized is omitted', async () => {
    const execute = vi.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (String(sql).includes('INSERT INTO animals')) {
        stored = params
      }
    })
    let stored: unknown[] = []
    const db = {
      execute,
      getAll: vi.fn().mockImplementation(async (sql: string) => {
        if (String(sql).includes('animal_statuses')) {
          return [{ id: 'st-1', label: 'Intake', sort_order: 1, counts_as_in_care: 1 }]
        }
        return []
      }),
      getOptional: vi.fn().mockImplementation(async () => ({
        id: 'animal-1',
        status_id: 'st-1',
        status_label: 'Intake',
      })),
    } as unknown as SanctuaryDb

    await createAnimal(db, {
      orgId: 'org-1',
      prefix: 'AWS',
      species: 'Cat',
      statusIds: ['st-1'],
    })

    expect(stored[stored.length - 1]).toBe('unknown')
    expect(String(execute.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO animals'))![0])).toContain(
      'sterilized',
    )
  })
})