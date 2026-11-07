import { describe, it, expect, vi } from 'vitest'
import { searchAnimals } from '@/features/animals/domain/animals'
import type { SanctuaryDb } from '@/shared/lib/db'

describe('reconcileAnimalsWithTimelineStatuses', () => {
  it('does NOT overwrite status to Transferred when a Transferred timeline treatment exists', async () => {
    const executeMock = vi.fn(async () => {})
    const mockDb: Partial<SanctuaryDb> = {
      getAll: vi.fn(async (sql: string) => {
        if (sql.includes('FROM animals a')) {
          return [
            {
              id: 'animal-1',
              org_id: 'org-1',
              name: 'Leo',
              status_id: 'status-in-care',
              status_label: 'In sanctuary',
              intake_date: '2026-10-29',
              shelter_code: 'TOSC-0282',
            },
          ]
        }
        if (sql.includes('FROM treatments') && sql.includes("treatment_type = 'status'")) {
          return [
            {
              animal_id: 'animal-1',
              notes: 'Transferred',
              treated_at: '2026-11-05T10:00:00.000Z',
              created_at: '2026-11-01T21:52:52.000Z',
            },
          ]
        }
        if (sql.includes('FROM treatments') && sql.includes("treatment_type IN ('arrived', 'intake')")) {
          return []
        }
        if (sql.includes('FROM animal_statuses')) {
          return [
            { id: 'status-in-care', label: 'In sanctuary' },
            { id: 'status-transferred', label: 'Transferred' },
          ]
        }
        return []
      }) as any,
      execute: executeMock,
    }

    const animals = await searchAnimals(mockDb as SanctuaryDb, 'org-1')
    expect(animals).toHaveLength(1)
    expect(animals[0].status_id).toBe('status-in-care')
    expect(animals[0].status_label).toBe('In sanctuary')
    expect(animals[0].status_labels).toEqual(['In sanctuary'])
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('reconciles valid in-care statuses like Treatment when status note differs', async () => {
    const executeMock = vi.fn(async () => {})
    const mockDb: Partial<SanctuaryDb> = {
      getAll: vi.fn(async (sql: string) => {
        if (sql.includes('FROM animals a')) {
          return [
            {
              id: 'animal-2',
              org_id: 'org-1',
              name: 'Casper',
              status_id: 'status-intake',
              status_label: 'Intake',
              intake_date: '2026-10-29',
              shelter_code: 'TOSC-0283',
            },
          ]
        }
        if (sql.includes('FROM treatments') && sql.includes("treatment_type = 'status'")) {
          return [
            {
              animal_id: 'animal-2',
              notes: 'Treatment',
              treated_at: '2026-10-30T10:00:00.000Z',
              created_at: '2026-10-30T10:00:00.000Z',
            },
          ]
        }
        if (sql.includes('FROM treatments') && sql.includes("treatment_type IN ('arrived', 'intake')")) {
          return []
        }
        if (sql.includes('FROM animal_statuses')) {
          return [
            { id: 'status-intake', label: 'Intake' },
            { id: 'status-treatment', label: 'Treatment' },
          ]
        }
        return []
      }) as any,
      execute: executeMock,
    }

    const animals = await searchAnimals(mockDb as SanctuaryDb, 'org-1')
    expect(animals).toHaveLength(1)
    expect(animals[0].status_id).toBe('status-treatment')
    expect(animals[0].status_label).toBe('Treatment')
    expect(animals[0].status_labels).toEqual(['Treatment'])
  })
})
