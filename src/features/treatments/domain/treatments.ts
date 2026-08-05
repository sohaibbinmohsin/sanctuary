import type { SanctuaryDb } from '@/shared/lib/db'
import type { TreatmentRecord } from '@/features/sync/powersync/schema'

export type TreatmentType = 'meds' | 'vet' | 'procedure' | 'other'

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
