import type { SanctuaryDb } from '@/shared/lib/db'
import type {
  LedgerCategoryRecord,
  LedgerEntryRecord,
} from '@/features/sync/powersync/schema'

export type LedgerDirection = 'in' | 'out'

export type AddLedgerEntryInput = {
  orgId: string
  categoryId: string
  direction: LedgerDirection
  amountCents: number
  entryDate?: string
  notes?: string
  animalId?: string
}

export function pkrToCents(amount: number): number {
  return Math.round(amount * 100)
}

export function formatPkr(cents: number): string {
  return `PKR ${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export async function listLedgerCategories(
  db: SanctuaryDb,
  orgId: string,
  includeArchived = false,
): Promise<LedgerCategoryRecord[]> {
  if (includeArchived) {
    return db.getAll<LedgerCategoryRecord>(
      `SELECT * FROM ledger_categories WHERE org_id = ? ORDER BY label ASC`,
      [orgId],
    )
  }
  return db.getAll<LedgerCategoryRecord>(
    `SELECT * FROM ledger_categories WHERE org_id = ? AND archived = 0 ORDER BY label ASC`,
    [orgId],
  )
}

export async function createLedgerCategory(
  db: SanctuaryDb,
  input: { orgId: string; label: string; direction: LedgerDirection },
): Promise<LedgerCategoryRecord> {
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  await db.execute(
    `INSERT INTO ledger_categories (id, org_id, label, direction, archived, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, input.orgId, input.label.trim(), input.direction, created_at],
  )
  return {
    id,
    org_id: input.orgId,
    label: input.label.trim(),
    direction: input.direction,
    archived: 0,
    created_at,
  }
}

export async function renameLedgerCategory(
  db: SanctuaryDb,
  id: string,
  label: string,
): Promise<void> {
  await db.execute(`UPDATE ledger_categories SET label = ? WHERE id = ?`, [
    label.trim(),
    id,
  ])
}

export async function archiveLedgerCategory(
  db: SanctuaryDb,
  id: string,
): Promise<void> {
  await db.execute(`UPDATE ledger_categories SET archived = 1 WHERE id = ?`, [
    id,
  ])
}

export async function addLedgerEntry(
  db: SanctuaryDb,
  input: AddLedgerEntryInput,
): Promise<LedgerEntryRecord> {
  if (input.amountCents <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  const entry_date = input.entryDate ?? created_at.slice(0, 10)

  await db.execute(
    `INSERT INTO ledger_entries (
      id, org_id, category_id, direction, amount_cents, entry_date, notes, animal_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.orgId,
      input.categoryId,
      input.direction,
      input.amountCents,
      entry_date,
      input.notes?.trim() || null,
      input.animalId ?? null,
      created_at,
    ],
  )

  return {
    id,
    org_id: input.orgId,
    category_id: input.categoryId,
    direction: input.direction,
    amount_cents: input.amountCents,
    entry_date,
    notes: input.notes?.trim() || null,
    animal_id: input.animalId ?? null,
    created_at,
  }
}

export async function listLedgerEntries(
  db: SanctuaryDb,
  orgId: string,
): Promise<(LedgerEntryRecord & { category_label?: string | null })[]> {
  return db.getAll(
    `SELECT e.*, c.label as category_label
     FROM ledger_entries e
     LEFT JOIN ledger_categories c ON c.id = e.category_id
     WHERE e.org_id = ?
     ORDER BY e.entry_date DESC, e.created_at DESC`,
    [orgId],
  )
}

export async function deleteLedgerEntry(
  db: SanctuaryDb,
  id: string,
): Promise<void> {
  await db.execute(`DELETE FROM ledger_entries WHERE id = ?`, [id])
}

export async function sumLedger(
  db: SanctuaryDb,
  orgId: string,
  range: { from?: string; to?: string } = {},
): Promise<{ inCents: number; outCents: number }> {
  const clauses = ['org_id = ?']
  const params: unknown[] = [orgId]
  if (range.from) {
    clauses.push('entry_date >= ?')
    params.push(range.from)
  }
  if (range.to) {
    clauses.push('entry_date <= ?')
    params.push(range.to)
  }

  const rows = await db.getAll<{ direction: string; total: number }>(
    `SELECT direction, SUM(amount_cents) as total
     FROM ledger_entries
     WHERE ${clauses.join(' AND ')}
     GROUP BY direction`,
    params,
  )

  let inCents = 0
  let outCents = 0
  for (const row of rows) {
    if (row.direction === 'in') inCents = Number(row.total) || 0
    if (row.direction === 'out') outCents = Number(row.total) || 0
  }
  return { inCents, outCents }
}
