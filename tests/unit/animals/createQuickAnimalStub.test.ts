import { describe, it, expect, vi } from 'vitest'
import {
  getNextShelterCode,
  createQuickAnimalStub,
} from '@/features/animals/domain/animals'
import { queuePhoto } from '@/features/photos/domain/photos'
import type { SanctuaryDb } from '@/shared/lib/db'

vi.mock('@/features/photos/domain/photos', () => ({
  queuePhoto: vi.fn().mockResolvedValue({ id: 'mock-photo-id' }),
}))

function createMockDb(): SanctuaryDb {
  const tables: Record<string, any[]> = {
    animals: [
      { id: '1', org_id: 'org-1', shelter_code: 'TS-0001', species: 'Dog', archived: 0 },
      { id: '2', org_id: 'org-1', shelter_code: 'TS-0002', species: 'Cat', archived: 0 },
    ],
    animal_statuses: [
      { id: 'st-1', org_id: 'org-1', label: 'Intake', counts_as_in_care: 1, sort_order: 1, archived: 0 },
      { id: 'st-2', org_id: 'org-1', label: 'Adopted', counts_as_in_care: 0, sort_order: 2, archived: 0 },
    ],
    treatments: [],
    animal_status_assignments: [],
    photos: [],
    local_photo_cache: [],
  }

  return {
    async getAll<T>(query: string, params: any[] = []): Promise<T[]> {
      const normalized = query.replace(/\s+/g, ' ')
      if (normalized.includes('FROM animals WHERE org_id = ?')) {
        return tables.animals.filter((a) => a.org_id === params[0]) as T[]
      }
      if (normalized.includes('FROM animal_statuses')) {
        let result = tables.animal_statuses.filter((s) => s.org_id === params[0])
        if (normalized.includes('AND id IN')) {
          const ids = params.slice(1)
          result = result.filter((s) => ids.includes(s.id))
        }
        return result as T[]
      }
      if (normalized.includes('FROM animal_status_assignments')) {
        return tables.animal_status_assignments.filter((a) => a.animal_id === params[0]) as T[]
      }
      return []
    },
    async getOptional<T>(query: string, params: any[] = []): Promise<T | null> {
      if (query.includes('FROM animals')) {
        const animal = tables.animals.find((a) => a.id === params[0])
        return animal ? ({ ...animal, status_label: 'Intake' } as T) : null
      }
      return null
    },
    async get<T>(query: string, params: any[] = []): Promise<T | null> {
      return (this as any).getOptional(query, params)
    },
    async execute(query: string, params: any[] = []): Promise<void> {
      if (query.includes('INSERT INTO animals')) {
        tables.animals.push({
          id: params[0],
          org_id: params[1],
          shelter_code: params[2],
          name: params[3],
          species: params[4],
          sex: params[5],
          markings: params[6],
          intake_date: params[7],
          status_id: params[8],
          notes: params[9],
          created_at: params[10],
          updated_at: params[11],
        })
      } else if (query.includes('INSERT INTO photos')) {
        tables.photos.push({ id: params[0], org_id: params[1], animal_id: params[2] })
      } else if (query.includes('INSERT INTO animal_status_assignments')) {
        tables.animal_status_assignments.push({ id: params[0], org_id: params[1], animal_id: params[2], status_id: params[3] })
      }
    },
    async writeTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      return fn(this)
    },
    async executeTransaction(fn: (tx: any) => Promise<void>): Promise<void> {
      return fn(this)
    },
  } as unknown as SanctuaryDb
}

describe('Quick Animal Stub Domain', () => {
  it('predicts the next sequential shelter code correctly', async () => {
    const db = createMockDb()
    const nextCode = await getNextShelterCode(db, 'org-1', 'TS')
    expect(nextCode).toBe('TS-0003')
  })

  it('creates an animal stub with Unknown species and in-care status', async () => {
    const db = createMockDb()
    const dummyBlob = new Blob(['mock-photo'], { type: 'image/jpeg' })

    const result = await createQuickAnimalStub(db, {
      orgId: 'org-1',
      prefix: 'TS',
      photoBlob: dummyBlob,
      captureSource: 'camera',
    })

    expect(result.shelterCode).toBe('TS-0003')
    expect(result.animal.species).toBe('Unknown')
    expect(result.animal.shelter_code).toBe('TS-0003')
    expect(queuePhoto).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        orgId: 'org-1',
        animalId: result.animal.id,
        blob: dummyBlob,
        captureSource: 'camera',
      }),
    )
  })

  it('uses explicitly provided statusId without querying default status', async () => {
    const db = createMockDb()
    const result = await createQuickAnimalStub(db, {
      orgId: 'org-1',
      prefix: 'TS',
      statusId: 'st-2',
    })

    expect(result.shelterCode).toBe('TS-0003')
    expect(result.animal.status_id).toBe('st-2')
  })

  it('throws an error if no animal status exists', async () => {
    const db = createMockDb()
    ;(db as any).getAll = vi.fn().mockImplementation(async (query: string) => {
      if (query.includes('FROM animal_statuses')) return []
      if (query.includes('FROM animals WHERE org_id = ?')) return []
      return []
    })

    await expect(
      createQuickAnimalStub(db, {
        orgId: 'org-1',
        prefix: 'TS',
      }),
    ).rejects.toThrow('No animal status found to assign.')
  })
})
