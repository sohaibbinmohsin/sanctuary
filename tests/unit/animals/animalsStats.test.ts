import { describe, it, expect } from 'vitest'
import {
  countAnimalsByLifeStage,
  countAnimalsBySpecies,
} from '@/features/animals/domain/animals'

describe('animals stats domain functions', () => {
  it('counts adult and child life stages', async () => {
    const mockDb = {
      getAll: async () => [
        { life_stage: 'adult', count: 12 },
        { life_stage: 'child', count: 5 },
      ],
    } as any

    const res = await countAnimalsByLifeStage(mockDb, 'org-1')
    expect(res.adult).toBe(12)
    expect(res.child).toBe(5)
  })

  it('counts animals by species ordered descending', async () => {
    const mockDb = {
      getAll: async () => [
        { species: 'Dog', count: 10 },
        { species: 'Cat', count: 7 },
      ],
    } as any

    const res = await countAnimalsBySpecies(mockDb, 'org-1')
    expect(res).toHaveLength(2)
    expect(res[0]).toEqual({ species: 'Dog', count: 10 })
  })
})
