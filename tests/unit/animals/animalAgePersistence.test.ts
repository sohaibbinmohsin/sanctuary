import { describe, expect, it, vi } from 'vitest'
import { setAnimalAge, updateAnimal } from '@/features/animals/domain/animals'
import type { SanctuaryDb } from '@/shared/lib/db'

function animalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'animal-1',
    org_id: 'org-1',
    shelter_code: 'AWS-0001',
    name: 'Mona',
    species: 'Cat',
    sex: 'Female',
    life_stage: 'adult',
    markings: null,
    intake_date: '2026-11-20',
    status_id: 'st-1',
    status_label: 'Intake',
    notes: null,
    archived: 0,
    ...overrides,
  }
}

describe('setAnimalAge', () => {
  it('stores years and months together', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = { execute } as unknown as SanctuaryDb

    await setAnimalAge(db, 'animal-1', { years: 2, months: 6 })

    expect(execute).toHaveBeenCalledTimes(1)
    const [sql, params] = execute.mock.calls[0]!
    expect(String(sql)).toContain('age_years')
    expect(String(sql)).toContain('age_months')
    expect(params).toEqual([2, 6, expect.any(String), 'animal-1'])
  })

  it('rejects a year the wheel cannot show', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = { execute } as unknown as SanctuaryDb

    await expect(setAnimalAge(db, 'animal-1', { years: 21, months: 0 })).rejects.toThrow(
      'Years must be a whole number from 0 to 20.',
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects a month the wheel cannot show', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = { execute } as unknown as SanctuaryDb

    await expect(setAnimalAge(db, 'animal-1', { years: 0, months: 12 })).rejects.toThrow(
      'Months must be a whole number from 0 to 11.',
    )
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('updateAnimal age columns', () => {
  it('does not write age when details are saved', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = {
      execute,
      getOptional: vi.fn().mockResolvedValue(animalRow()),
      getAll: vi.fn().mockResolvedValue([]),
    } as unknown as SanctuaryDb

    await updateAnimal(db, 'animal-1', {
      species: 'Cat',
      name: 'Mona',
      sex: 'Female',
      life_stage: 'adult',
    })

    const updates = execute.mock.calls.filter(([sql]) =>
      String(sql).includes('UPDATE animals'),
    )
    expect(updates.length).toBeGreaterThan(0)
    for (const [sql] of updates) {
      expect(String(sql)).not.toContain('age_years')
      expect(String(sql)).not.toContain('age_months')
    }
  })
})