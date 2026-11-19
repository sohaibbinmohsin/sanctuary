import { describe, expect, it, vi } from 'vitest'
import { addTreatment, updateTreatment } from '@/features/treatments/domain/treatments'
import { vaccinationCareTitle } from '@/features/treatments/domain/vaccines'
import type { SanctuaryDb } from '@/shared/lib/db'

describe('vaccinationCareTitle', () => {
  it('names the vaccine on the care entry', () => {
    expect(vaccinationCareTitle('rabies')).toBe('Vaccination · Rabies')
    expect(vaccinationCareTitle('calci_fpv')).toBe('Vaccination · Calci/FPV')
    expect(vaccinationCareTitle(null)).toBe('Vaccination')
    expect(vaccinationCareTitle('future_vaccine')).toBe('Vaccination')
  })
})

describe('addTreatment vaccination', () => {
  it('stores one vaccine and allows an empty note', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = { execute } as unknown as SanctuaryDb

    const saved = await addTreatment(db, {
      orgId: 'org-1',
      animalId: 'animal-1',
      treatmentType: 'vaccination',
      vaccine: 'rabies',
      treatedAt: '2026-11-20T12:00:00.000Z',
    })

    const [sql, params] = execute.mock.calls[0]!
    expect(String(sql)).toContain('vaccine')
    expect(params).toContain('vaccination')
    expect(params).toContain('rabies')
    expect(params).toContain(null)
    expect(saved.treatment_type).toBe('vaccination')
    expect(saved.vaccine).toBe('rabies')
    expect(saved.notes).toBeNull()
  })

  it('rejects a vaccination without a known vaccine', async () => {
    const execute = vi.fn()
    const db = { execute } as unknown as SanctuaryDb
    await expect(
      addTreatment(db, {
        orgId: 'org-1',
        animalId: 'animal-1',
        treatmentType: 'vaccination',
      }),
    ).rejects.toThrow('Choose a vaccine.')
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects a vaccine on a procedure entry', async () => {
    const db = { execute: vi.fn() } as unknown as SanctuaryDb
    await expect(
      addTreatment(db, {
        orgId: 'org-1',
        animalId: 'animal-1',
        treatmentType: 'procedure',
        notes: 'Spay',
        vaccine: 'rabies',
      }),
    ).rejects.toThrow('Vaccine is only stored on vaccination entries.')
  })
})

describe('updateTreatment vaccination', () => {
  it('clears vaccine when the entry is changed to medicine', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = {
      execute,
      getOptional: vi.fn().mockResolvedValue({
        id: 'care-1',
        org_id: 'org-1',
        animal_id: 'animal-1',
        treated_at: '2026-11-20T12:00:00.000Z',
        treatment_type: 'vaccination',
        vaccine: 'rabies',
        notes: null,
        ledger_entry_id: null,
        hide_from_public: 0,
        created_at: '2026-11-20T12:00:00.000Z',
      }),
    } as unknown as SanctuaryDb

    await updateTreatment(db, 'care-1', {
      treatmentType: 'meds',
      notes: 'Antibiotic',
    })

    const [sql, params] = execute.mock.calls[0]!
    expect(String(sql)).toContain('vaccine')
    expect(params[1]).toBe('meds')
    expect(params).toContain(null)
    expect(String(sql).toLowerCase()).not.toContain('sterilized')
  })
})