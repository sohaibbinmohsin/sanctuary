import type { SanctuaryDb } from '@/shared/lib/db'
import { addTreatment } from '@/features/treatments/domain/treatments'

export type AssignedStatus = {
  status_id: string
  label: string
  sort_order: number
  counts_as_in_care: number
}

type StatusForAssignment = {
  id: string
  label: string
  sort_order: number
  counts_as_in_care: number
}

export async function listAssignmentsForAnimal(
  db: SanctuaryDb,
  animalId: string,
): Promise<AssignedStatus[]> {
  return db.getAll<AssignedStatus>(
    `SELECT asa.status_id, s.label, s.sort_order, s.counts_as_in_care
     FROM animal_status_assignments asa
     JOIN animal_statuses s ON s.id = asa.status_id
     WHERE asa.animal_id = ?
     ORDER BY s.sort_order ASC, s.label ASC`,
    [animalId],
  )
}

export function resolvePrimaryStatusId(
  statuses: StatusForAssignment[],
): string {
  if (statuses.length === 0) {
    throw new Error('At least one status is required.')
  }

  return [...statuses].sort((a, b) => {
    const careOrder = a.counts_as_in_care - b.counts_as_in_care
    if (careOrder !== 0) return careOrder

    const sortOrder = a.sort_order - b.sort_order
    if (sortOrder !== 0) return sortOrder

    const labelOrder = a.label.localeCompare(b.label)
    if (labelOrder !== 0) return labelOrder

    return a.id.localeCompare(b.id)
  })[0].id
}

export async function replaceAnimalStatuses(
  db: SanctuaryDb,
  input: {
    orgId: string
    animalId: string
    statusIds: string[]
  },
): Promise<void> {
  if (input.statusIds.length === 0) {
    throw new Error('At least one status is required.')
  }

  const requestedIds = [...new Set(input.statusIds)]
  const placeholders = requestedIds.map(() => '?').join(', ')
  const loadedStatuses = await db.getAll<StatusForAssignment>(
    `SELECT id, label, sort_order, counts_as_in_care
     FROM animal_statuses
     WHERE org_id = ? AND id IN (${placeholders})`,
    [input.orgId, ...requestedIds],
  )
  const statusesById = new Map(
    loadedStatuses.map((status) => [status.id, status]),
  )

  if (statusesById.size !== requestedIds.length) {
    throw new Error('One or more statuses were not found.')
  }

  const firstExitId = requestedIds.find(
    (id) => statusesById.get(id)?.counts_as_in_care === 0,
  )
  const selectedIds = firstExitId ? [firstExitId] : requestedIds
  const selectedStatuses = selectedIds.map((id) => statusesById.get(id)!)

  const currentAssignments = await db.getAll<{ status_id: string }>(
    `SELECT status_id
     FROM animal_status_assignments
     WHERE animal_id = ?`,
    [input.animalId],
  )
  const currentIds = new Set(
    currentAssignments.map((assignment) => assignment.status_id),
  )
  const unchanged =
    currentIds.size === selectedIds.length &&
    selectedIds.every((id) => currentIds.has(id))
  if (unchanged) return

  const now = new Date().toISOString()
  const primaryStatusId = resolvePrimaryStatusId(selectedStatuses)

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `DELETE FROM animal_status_assignments WHERE animal_id = ?`,
      [input.animalId],
    )

    for (const statusId of selectedIds) {
      await tx.execute(
        `INSERT INTO animal_status_assignments (
          id, org_id, animal_id, status_id, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          input.orgId,
          input.animalId,
          statusId,
          now,
        ],
      )
    }

    await tx.execute(
      `UPDATE animals SET status_id = ?, updated_at = ? WHERE id = ?`,
      [primaryStatusId, now, input.animalId],
    )
  })

  const notes = [...selectedStatuses]
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    )
    .map((status) => status.label)
    .join(', ')

  await addTreatment(db, {
    orgId: input.orgId,
    animalId: input.animalId,
    treatmentType: 'status',
    notes,
    treatedAt: now,
  })
}
