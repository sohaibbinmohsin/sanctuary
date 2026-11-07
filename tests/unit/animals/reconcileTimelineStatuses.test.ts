import { describe, expect, it, vi } from 'vitest'
import {
  reconcileAnimalsWithTimelineStatuses,
  getAnimal,
  searchAnimals,
  type AnimalWithStatus,
} from '@/features/animals/domain/animals'
import type { SanctuaryDb } from '@/shared/lib/db'

describe('reconcileAnimalsWithTimelineStatuses', () => {
  const orgStatuses = [
    { id: 'st-intake', label: 'Intake', sort_order: 1, counts_as_in_care: 1, archived: 0 },
    { id: 'st-quarantine', label: 'Quarantine', sort_order: 2, counts_as_in_care: 1, archived: 0 },
    { id: 'st-treatment', label: 'Treatment', sort_order: 3, counts_as_in_care: 1, archived: 0 },
    { id: 'st-transferred', label: 'Transferred', sort_order: 4, counts_as_in_care: 0, archived: 0 },
  ]

  const baseAnimal: AnimalWithStatus = {
    id: 'anim-1',
    org_id: 'org-gaza',
    shelter_code: 'GAR-0026',
    name: 'Sukar',
    species: 'Cat',
    sex: 'Female',
    life_stage: 'adult',
    markings: null,
    notes: null,
    intake_date: '2026-11-01',
    status_id: 'st-intake',
    status_label: 'Intake',
    status_labels: ['Intake'],
    archived: 0,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  }

  it('does NOT overwrite animal.status_id from a timeline note that starts with "Transferred"', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getAll = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("treatment_type = 'status'")) {
        return [
          {
            animal_id: 'anim-1',
            notes: 'Transferred',
            treated_at: '2026-11-08T15:00:00Z',
            created_at: '2026-11-01T10:00:00Z',
          },
        ]
      }
      if (sql.includes("treatment_type IN ('arrived', 'intake')")) {
        return [{ animal_id: 'anim-1' }]
      }
      if (sql.includes('animal_statuses')) {
        return orgStatuses
      }
      return []
    })

    const db = { getAll, execute } as unknown as SanctuaryDb

    const [reconciled] = await reconcileAnimalsWithTimelineStatuses(db, 'org-gaza', [baseAnimal])

    // Must remain Intake and NOT flip to Transferred
    expect(reconciled.status_id).toBe('st-intake')
    expect(reconciled.status_label).toBe('Intake')
    // Must NOT execute any DB update to force Transferred
    expect(execute).not.toHaveBeenCalled()
  })

  it('does NOT overwrite status when note is formatted as "Transferred - Transferred to: Partner"', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getAll = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("treatment_type = 'status'")) {
        return [
          {
            animal_id: 'anim-1',
            notes: 'Transferred - Transferred to: Gaza Animal Rescues Partner',
            treated_at: '2026-11-06T12:00:00Z',
            created_at: '2026-11-06T12:00:00Z',
          },
        ]
      }
      if (sql.includes("treatment_type IN ('arrived', 'intake')")) {
        return []
      }
      if (sql.includes('animal_statuses')) {
        return orgStatuses
      }
      return []
    })

    const db = { getAll, execute } as unknown as SanctuaryDb

    const [reconciled] = await reconcileAnimalsWithTimelineStatuses(db, 'org-gaza', [baseAnimal])

    expect(reconciled.status_id).toBe('st-intake')
    expect(reconciled.status_label).toBe('Intake')
    expect(execute).not.toHaveBeenCalled()
  })

  it('does NOT overwrite status when note is lowercase "transferred"', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getAll = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("treatment_type = 'status'")) {
        return [
          {
            animal_id: 'anim-1',
            notes: 'transferred',
            treated_at: '2026-11-06T12:00:00Z',
            created_at: '2026-11-06T12:00:00Z',
          },
        ]
      }
      if (sql.includes("treatment_type IN ('arrived', 'intake')")) {
        return []
      }
      if (sql.includes('animal_statuses')) {
        return orgStatuses
      }
      return []
    })

    const db = { getAll, execute } as unknown as SanctuaryDb

    const [reconciled] = await reconcileAnimalsWithTimelineStatuses(db, 'org-gaza', [baseAnimal])

    expect(reconciled.status_id).toBe('st-intake')
    expect(reconciled.status_label).toBe('Intake')
    expect(execute).not.toHaveBeenCalled()
  })

  it('still reconciles legitimate non-transferred status notes (e.g. Treatment)', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getAll = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("treatment_type = 'status'")) {
        return [
          {
            animal_id: 'anim-1',
            notes: 'Treatment - In clinic for observation',
            treated_at: '2026-11-06T12:00:00Z',
            created_at: '2026-11-06T12:00:00Z',
          },
        ]
      }
      if (sql.includes("treatment_type IN ('arrived', 'intake')")) {
        return []
      }
      if (sql.includes('animal_statuses')) {
        return orgStatuses
      }
      return []
    })

    const db = { getAll, execute } as unknown as SanctuaryDb

    const [reconciled] = await reconcileAnimalsWithTimelineStatuses(db, 'org-gaza', [baseAnimal])

    expect(reconciled.status_id).toBe('st-treatment')
    expect(reconciled.status_label).toBe('Treatment')
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE animals SET status_id = ?'),
      expect.arrayContaining(['st-treatment', 'anim-1']),
    )
  })

  it('keeps in-care status on getAnimal when stale Transferred note is in treatments', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getOptional = vi.fn().mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-gaza',
      shelter_code: 'GAR-0027',
      name: 'Lana',
      species: 'Cat',
      sex: 'Female',
      life_stage: 'adult',
      intake_date: '2026-11-01',
      status_id: 'st-intake',
      status_label: 'Intake',
      archived: 0,
      created_at: '2026-11-01T10:00:00Z',
      updated_at: '2026-11-01T10:00:00Z',
    })

    const getAll = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("treatment_type = 'status'")) {
        return [
          {
            animal_id: 'anim-1',
            notes: 'Transferred',
            treated_at: '2026-11-08T15:00:00Z',
            created_at: '2026-11-01T10:00:00Z',
          },
        ]
      }
      if (sql.includes("treatment_type IN ('arrived', 'intake')")) {
        return []
      }
      if (sql.includes('animal_statuses')) {
        return orgStatuses
      }
      if (sql.includes('animal_status_assignments')) {
        return [{ id: 'st-intake', label: 'Intake' }]
      }
      return []
    })

    const db = { getOptional, getAll, execute } as unknown as SanctuaryDb

    const result = await getAnimal(db, 'anim-1')

    expect(result).not.toBeNull()
    expect(result?.status_id).toBe('st-intake')
    expect(result?.status_label).toBe('Intake')
    expect(execute).not.toHaveBeenCalled()
  })

  it('keeps in-care status on searchAnimals when stale Transferred note is in treatments', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getAll = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM animals a')) {
        return [
          {
            id: 'anim-1',
            org_id: 'org-gaza',
            shelter_code: 'GAR-0028',
            name: 'Loay',
            species: 'Dog',
            sex: 'Male',
            life_stage: 'adult',
            intake_date: '2026-11-01',
            status_id: 'st-intake',
            status_label: 'Intake',
            archived: 0,
            created_at: '2026-11-01T10:00:00Z',
            updated_at: '2026-11-01T10:00:00Z',
          },
        ]
      }
      if (sql.includes("treatment_type = 'status'")) {
        return [
          {
            animal_id: 'anim-1',
            notes: 'Transferred - transferred to external facility',
            treated_at: '2026-11-08T15:00:00Z',
            created_at: '2026-11-01T10:00:00Z',
          },
        ]
      }
      if (sql.includes("treatment_type IN ('arrived', 'intake')")) {
        return []
      }
      if (sql.includes('animal_statuses')) {
        return orgStatuses
      }
      return []
    })

    const db = { getAll, execute } as unknown as SanctuaryDb

    const results = await searchAnimals(db, 'org-gaza', {})

    expect(results).toHaveLength(1)
    expect(results[0]?.status_id).toBe('st-intake')
    expect(results[0]?.status_label).toBe('Intake')
    expect(execute).not.toHaveBeenCalled()
  })
})
