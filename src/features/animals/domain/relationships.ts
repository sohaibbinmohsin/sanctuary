import type { SanctuaryDb } from '@/shared/lib/db'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'

export type RelationshipType =
  | 'bonded'
  | 'mother'
  | 'child'
  | 'sibling'
  | 'incompatible'

export type AnimalRelationship = {
  id: string
  orgId: string
  animalId: string
  relatedAnimalId: string
  relatedAnimalName: string
  relatedShelterCode: string
  relatedSpecies: string
  relatedLifeStage: 'adult' | 'child'
  relatedPhotoUrl: string | null
  relationshipType: RelationshipType
  notes: string | null
  createdAt: string
}

export function getReciprocalType(type: RelationshipType): RelationshipType {
  switch (type) {
    case 'mother':
      return 'child'
    case 'child':
      return 'mother'
    case 'bonded':
      return 'bonded'
    case 'sibling':
      return 'sibling'
    case 'incompatible':
      return 'incompatible'
    default: {
      const exhaustiveCheck: never = type
      throw new Error(`Unhandled relationship type: ${exhaustiveCheck}`)
    }
  }
}

export async function getAnimalRelationships(
  db: SanctuaryDb,
  animalId: string,
): Promise<AnimalRelationship[]> {
  const rows = await db.getAll<{
    id: string
    org_id: string
    animal_id: string
    related_animal_id: string
    relationship_type: RelationshipType
    notes: string | null
    created_at: string
    related_name: string
    related_shelter_code: string
    related_species: string
    related_life_stage: 'adult' | 'child'
    related_photo_url: string | null
  }>(
    `SELECT
       ar.id,
       ar.org_id,
       ar.animal_id,
       ar.related_animal_id,
       ar.relationship_type,
       ar.notes,
       ar.created_at,
       a.name AS related_name,
       a.shelter_code AS related_shelter_code,
       a.species AS related_species,
       a.life_stage AS related_life_stage,
       (
         SELECT r2_key FROM photos
         WHERE animal_id = a.id
         ORDER BY created_at DESC
         LIMIT 1
       ) AS related_photo_url
     FROM animal_relationships ar
     JOIN animals a ON a.id = ar.related_animal_id
     WHERE ar.animal_id = ?
     ORDER BY ar.created_at DESC`,
    [animalId],
  )

  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    animalId: r.animal_id,
    relatedAnimalId: r.related_animal_id,
    relatedAnimalName: r.related_name || '',
    relatedShelterCode: r.related_shelter_code || '',
    relatedSpecies: r.related_species || '',
    relatedLifeStage: (r.related_life_stage as 'adult' | 'child') || 'adult',
    relatedPhotoUrl: r.related_photo_url
      ? (publicPhotoUrl(r.related_photo_url) ?? r.related_photo_url)
      : null,
    relationshipType: r.relationship_type,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  }))
}

export async function linkAnimals(
  db: SanctuaryDb,
  input: {
    orgId: string
    animalId: string
    relatedAnimalId: string
    relationshipType: RelationshipType
    notes?: string | null
  },
): Promise<void> {
  if (input.animalId === input.relatedAnimalId) {
    throw new Error('Cannot link an animal to itself')
  }

  const reciprocalType = getReciprocalType(input.relationshipType)
  const now = new Date().toISOString()
  const id1 = crypto.randomUUID()
  const id2 = crypto.randomUUID()
  const notes = input.notes?.trim() || null

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO animal_relationships (
        id, org_id, animal_id, related_animal_id, relationship_type, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id1,
        input.orgId,
        input.animalId,
        input.relatedAnimalId,
        input.relationshipType,
        notes,
        now,
      ],
    )

    await tx.execute(
      `INSERT INTO animal_relationships (
        id, org_id, animal_id, related_animal_id, relationship_type, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id2,
        input.orgId,
        input.relatedAnimalId,
        input.animalId,
        reciprocalType,
        notes,
        now,
      ],
    )
  })
}

export async function unlinkAnimals(
  db: SanctuaryDb,
  input: { animalId: string; relatedAnimalId: string },
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `DELETE FROM animal_relationships WHERE animal_id = ? AND related_animal_id = ?`,
      [input.animalId, input.relatedAnimalId],
    )
    await tx.execute(
      `DELETE FROM animal_relationships WHERE animal_id = ? AND related_animal_id = ?`,
      [input.relatedAnimalId, input.animalId],
    )
  })
}
