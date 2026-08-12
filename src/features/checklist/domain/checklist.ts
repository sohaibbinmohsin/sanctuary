import type { AnimalRecord } from '@/features/sync/powersync/schema'
import type { SanctuaryDb } from '@/shared/lib/db'
import {
  localDateString,
  missedDayStreak,
} from '@/shared/lib/checklist/missedStreak'

export type ChecklistRow = AnimalRecord & {
  added_at: string
  added_by: string | null
  checkedToday: boolean
  missedDays: number
}

type ChecklistAnimal = AnimalRecord & {
  added_at: string
  added_by: string | null
}

export async function addAnimalsToChecklist(
  db: SanctuaryDb,
  input: {
    orgId: string
    animalIds: string[]
    addedBy?: string
  },
): Promise<{ added: number; skipped: number }> {
  const uniqueAnimalIds = [...new Set(input.animalIds)]
  if (uniqueAnimalIds.length === 0) return { added: 0, skipped: 0 }

  const placeholders = uniqueAnimalIds.map(() => '?').join(', ')
  const existing = await db.getAll<{ animal_id: string }>(
    `SELECT animal_id FROM checklist_items
     WHERE org_id = ? AND animal_id IN (${placeholders})`,
    [input.orgId, ...uniqueAnimalIds],
  )
  const existingIds = new Set(existing.map((row) => row.animal_id))
  const animalIdsToAdd = uniqueAnimalIds.filter((id) => !existingIds.has(id))
  const addedAt = new Date().toISOString()

  for (const animalId of animalIdsToAdd) {
    await db.execute(
      `INSERT INTO checklist_items (id, org_id, animal_id, added_at, added_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        input.orgId,
        animalId,
        addedAt,
        input.addedBy ?? null,
      ],
    )
  }

  return {
    added: animalIdsToAdd.length,
    skipped: input.animalIds.length - animalIdsToAdd.length,
  }
}

export async function removeFromChecklist(
  db: SanctuaryDb,
  input: { orgId: string; animalId: string },
): Promise<void> {
  await db.execute(
    `DELETE FROM checklist_items WHERE org_id = ? AND animal_id = ?`,
    [input.orgId, input.animalId],
  )
}

export async function removeChecklistItemForAnimal(
  db: SanctuaryDb,
  animalId: string,
): Promise<void> {
  await db.execute(`DELETE FROM checklist_items WHERE animal_id = ?`, [animalId])
}

export async function setChecklistChecked(
  db: SanctuaryDb,
  input: {
    orgId: string
    animalId: string
    checked: boolean
    today?: string
    checkedBy?: string
  },
): Promise<void> {
  const today = input.today ?? localDateString()
  if (!input.checked) {
    await db.execute(
      `DELETE FROM checklist_checks
       WHERE org_id = ? AND animal_id = ? AND check_date = ?`,
      [input.orgId, input.animalId, today],
    )
    return
  }

  const existing = await db.getOptional<{ id: string }>(
    `SELECT id FROM checklist_checks
     WHERE org_id = ? AND animal_id = ? AND check_date = ?`,
    [input.orgId, input.animalId, today],
  )
  const checkedAt = new Date().toISOString()
  if (existing) {
    await db.execute(
      `UPDATE checklist_checks SET checked_at = ?, checked_by = ? WHERE id = ?`,
      [checkedAt, input.checkedBy ?? null, existing.id],
    )
    return
  }

  await db.execute(
    `INSERT INTO checklist_checks (
      id, org_id, animal_id, check_date, checked_at, checked_by
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.orgId,
      input.animalId,
      today,
      checkedAt,
      input.checkedBy ?? null,
    ],
  )
}

export async function listChecklist(
  db: SanctuaryDb,
  orgId: string,
  today = localDateString(),
): Promise<ChecklistRow[]> {
  const animals = await db.getAll<ChecklistAnimal>(
    `SELECT a.*, ci.added_at, ci.added_by
     FROM checklist_items ci
     JOIN animals a ON a.id = ci.animal_id AND a.org_id = ci.org_id
     WHERE ci.org_id = ? AND a.archived = 0
     ORDER BY a.shelter_code ASC`,
    [orgId],
  )
  if (animals.length === 0) return []

  const checks = await db.getAll<{ animal_id: string; check_date: string }>(
    `SELECT animal_id, check_date
     FROM checklist_checks
     WHERE org_id = ?`,
    [orgId],
  )
  const checkDatesByAnimal = new Map<string, string[]>()
  for (const check of checks) {
    const dates = checkDatesByAnimal.get(check.animal_id) ?? []
    dates.push(check.check_date)
    checkDatesByAnimal.set(check.animal_id, dates)
  }

  return animals.map((animal) => {
    const checkDates = checkDatesByAnimal.get(animal.id) ?? []
    return {
      ...animal,
      checkedToday: checkDates.includes(today),
      missedDays: missedDayStreak({
        addedAtIso: animal.added_at,
        checkDates,
        today,
      }),
    }
  })
}

export function countChecklistOverdue(rows: ChecklistRow[]): number {
  return rows.filter((row) => row.missedDays >= 1).length
}
