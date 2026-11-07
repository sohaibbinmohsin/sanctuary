import { describe, it, expect, vi } from 'vitest'
import { searchAnimals } from '@/features/animals/domain/animals'
import type { SanctuaryDb } from '@/shared/lib/db'

describe('searchAnimals direct status resolution', () => {
  it('resolves animal status directly from animal_statuses without querying treatments or rewriting status', async () => {
    const executeMock = vi.fn(async () => {})
    const getAllMock = vi.fn(async (sql: string) => {
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
      return []
    }) as any

    const mockDb: Partial<SanctuaryDb> = {
      getAll: getAllMock,
      execute: executeMock,
    }

    const animals = await searchAnimals(mockDb as SanctuaryDb, 'org-1')
    expect(animals).toHaveLength(1)
    expect(animals[0].status_id).toBe('status-in-care')
    expect(animals[0].status_label).toBe('In sanctuary')
    expect(animals[0].status_labels).toEqual(['In sanctuary'])
    expect(executeMock).not.toHaveBeenCalled()
    // Verify no treatments queries were issued
    const treatmentQueries = getAllMock.mock.calls.filter(([sql]: [string]) =>
      sql.includes('treatments'),
    )
    expect(treatmentQueries).toHaveLength(0)
  })

  it('preserves assigned status without running side-effect writes', async () => {
    const executeMock = vi.fn(async () => {})
    const mockDb: Partial<SanctuaryDb> = {
      getAll: vi.fn(async (sql: string) => {
        if (sql.includes('FROM animals a')) {
          return [
            {
              id: 'animal-2',
              org_id: 'org-1',
              name: 'Casper',
              status_id: 'status-treatment',
              status_label: 'Treatment',
              intake_date: '2026-10-29',
              shelter_code: 'TOSC-0283',
            },
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
    expect(executeMock).not.toHaveBeenCalled()
  })
})
