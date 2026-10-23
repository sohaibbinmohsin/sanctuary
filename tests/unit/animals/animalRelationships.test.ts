import { describe, it, expect, beforeEach } from 'vitest'
import {
  getReciprocalType,
  linkAnimals,
  unlinkAnimals,
  getAnimalRelationships,
} from '@/features/animals/domain/relationships'

type MemoryRow = Record<string, unknown>

class MockDb {
  tables: Record<string, MemoryRow[]> = {
    animal_relationships: [],
    animals: [],
    photos: [],
  }

  async getAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('FROM animal_relationships')) {
      const animalId = params[0] as string
      const rels = this.tables.animal_relationships.filter((r) => r.animal_id === animalId)
      return rels.map((r) => {
        const animal = this.tables.animals.find((a) => a.id === r.related_animal_id) || {}
        return {
          id: r.id,
          org_id: r.org_id,
          animal_id: r.animal_id,
          related_animal_id: r.related_animal_id,
          relationship_type: r.relationship_type,
          notes: r.notes,
          created_at: r.created_at,
          related_name: animal.name || '',
          related_shelter_code: animal.shelter_code || '',
          related_species: animal.species || '',
          related_life_stage: animal.life_stage || 'adult',
          related_photo_url: null,
        }
      }) as unknown as T[]
    }
    return []
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.startsWith('INSERT INTO animal_relationships')) {
      this.tables.animal_relationships.push({
        id: params[0],
        org_id: params[1],
        animal_id: params[2],
        related_animal_id: params[3],
        relationship_type: params[4],
        notes: params[5],
        created_at: params[6],
      })
    } else if (sql.startsWith('DELETE FROM animal_relationships')) {
      const a = params[0] as string
      const b = params[1] as string
      this.tables.animal_relationships = this.tables.animal_relationships.filter(
        (r) => !(r.animal_id === a && r.related_animal_id === b),
      )
    }
  }

  async writeTransaction<T>(fn: (tx: MockDb) => Promise<T>): Promise<T> {
    return fn(this)
  }
}

describe('Animal Relationships Domain', () => {
  let db: MockDb

  beforeEach(() => {
    db = new MockDb()
    db.tables.animals = [
      { id: 'a1', org_id: 'org1', name: 'Luna', shelter_code: 'LUN', species: 'Cat', life_stage: 'adult' },
      { id: 'a2', org_id: 'org1', name: 'Shadow', shelter_code: 'SHA', species: 'Cat', life_stage: 'child' },
    ]
  })

  it('correctly determines reciprocal types', () => {
    expect(getReciprocalType('bonded')).toBe('bonded')
    expect(getReciprocalType('sibling')).toBe('sibling')
    expect(getReciprocalType('incompatible')).toBe('incompatible')
    expect(getReciprocalType('mother')).toBe('child')
    expect(getReciprocalType('child')).toBe('mother')
  })

  it('rejects linking animal to itself', async () => {
    await expect(
      linkAnimals(db as any, {
        orgId: 'org1',
        animalId: 'a1',
        relatedAnimalId: 'a1',
        relationshipType: 'bonded',
      }),
    ).rejects.toThrow('Cannot link an animal to itself')
  })

  it('creates reciprocal records in a transaction', async () => {
    await linkAnimals(db as any, {
      orgId: 'org1',
      animalId: 'a1',
      relatedAnimalId: 'a2',
      relationshipType: 'mother',
      notes: 'Litter born in spring',
    })

    const a1Rels = await getAnimalRelationships(db as any, 'a1')
    expect(a1Rels).toHaveLength(1)
    expect(a1Rels[0].relatedAnimalName).toBe('Shadow')
    expect(a1Rels[0].relationshipType).toBe('mother')

    const a2Rels = await getAnimalRelationships(db as any, 'a2')
    expect(a2Rels).toHaveLength(1)
    expect(a2Rels[0].relatedAnimalName).toBe('Luna')
    expect(a2Rels[0].relationshipType).toBe('child')
  })

  it('unlinks both directional records atomically', async () => {
    await linkAnimals(db as any, {
      orgId: 'org1',
      animalId: 'a1',
      relatedAnimalId: 'a2',
      relationshipType: 'bonded',
    })

    await unlinkAnimals(db as any, { animalId: 'a1', relatedAnimalId: 'a2' })

    const a1Rels = await getAnimalRelationships(db as any, 'a1')
    const a2Rels = await getAnimalRelationships(db as any, 'a2')
    expect(a1Rels).toHaveLength(0)
    expect(a2Rels).toHaveLength(0)
  })
})
