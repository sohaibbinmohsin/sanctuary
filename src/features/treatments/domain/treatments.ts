import type { SanctuaryDb } from '@/shared/lib/db'
import type { TreatmentRecord } from '@/features/sync/powersync/schema'

export type TreatmentType =
  | 'meds'
  | 'vet'
  | 'procedure'
  | 'other'
  | 'intake'
  | 'arrived'
  | 'status'

export function isArrivalTreatmentType(type: string | null | undefined): boolean {
  return type === 'arrived' || type === 'intake'
}

export type AddTreatmentInput = {
  orgId: string
  animalId: string
  treatmentType: TreatmentType
  notes?: string
  treatedAt?: string
  ledgerEntryId?: string
}

export async function addTreatment(
  db: SanctuaryDb,
  input: AddTreatmentInput,
): Promise<TreatmentRecord> {
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  const treated_at = input.treatedAt ?? created_at

  await db.execute(
    `INSERT INTO treatments (
      id, org_id, animal_id, treated_at, treatment_type, notes, ledger_entry_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.orgId,
      input.animalId,
      treated_at,
      input.treatmentType,
      input.notes?.trim() || null,
      input.ledgerEntryId ?? null,
      created_at,
    ],
  )

  return {
    id,
    org_id: input.orgId,
    animal_id: input.animalId,
    treated_at,
    treatment_type: input.treatmentType,
    notes: input.notes?.trim() || null,
    ledger_entry_id: input.ledgerEntryId ?? null,
    created_at,
  }
}

export async function listTreatmentsForAnimal(
  db: SanctuaryDb,
  animalId: string,
): Promise<TreatmentRecord[]> {
  return db.getAll<TreatmentRecord>(
    `SELECT * FROM treatments WHERE animal_id = ? ORDER BY treated_at DESC, created_at DESC`,
    [animalId],
  )
}

export type UpdateTreatmentInput = {
  treatmentType: TreatmentType
  notes?: string
  treatedAt?: string
  ledgerEntryId?: string | null
}

export async function updateTreatment(
  db: SanctuaryDb,
  id: string,
  input: UpdateTreatmentInput,
): Promise<void> {
  const existing = await getTreatment(db, id)
  if (!existing) throw new Error('Care note not found')

  const treated_at = input.treatedAt ?? existing.treated_at ?? new Date().toISOString()
  const notes = input.notes?.trim() || null
  const ledgerEntryId =
    input.ledgerEntryId === undefined
      ? existing.ledger_entry_id
      : input.ledgerEntryId

  await db.execute(
    `UPDATE treatments SET
      treated_at = ?,
      treatment_type = ?,
      notes = ?,
      ledger_entry_id = ?
     WHERE id = ?`,
    [
      treated_at,
      input.treatmentType,
      notes,
      ledgerEntryId,
      id,
    ],
  )

  // Arrival care notes mirror animals.notes / intake_date.
  if (
    isArrivalTreatmentType(existing.treatment_type) ||
    isArrivalTreatmentType(input.treatmentType)
  ) {
    if (isArrivalTreatmentType(input.treatmentType)) {
      const intakeDate = treated_at.slice(0, 10)
      await db.execute(
        `UPDATE animals SET notes = ?, intake_date = ?, updated_at = ? WHERE id = ?`,
        [notes, intakeDate, new Date().toISOString(), existing.animal_id],
      )
    } else {
      await db.execute(
        `UPDATE animals SET notes = ?, updated_at = ? WHERE id = ?`,
        [null, new Date().toISOString(), existing.animal_id],
      )
    }
  }
}

export async function getTreatment(
  db: SanctuaryDb,
  id: string,
): Promise<TreatmentRecord | null> {
  return db.getOptional<TreatmentRecord>(
    `SELECT * FROM treatments WHERE id = ?`,
    [id],
  )
}

export async function deleteTreatment(
  db: SanctuaryDb,
  id: string,
): Promise<void> {
  await db.execute(`DELETE FROM treatments WHERE id = ?`, [id])
}
