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
  currency?: CurrencyCode
  entryDate?: string
  notes?: string
  animalId?: string
  /** Donations only — hide donor identity on the public page. */
  isAnonymous?: boolean
  /** Hide this entry from the public shelter page. Defaults to 0. */
  hideFromPublic?: boolean
}

export type UpdateLedgerEntryInput = {
  categoryId: string
  direction: LedgerDirection
  amountCents: number
  currency?: CurrencyCode
  entryDate: string
  notes?: string
  animalId?: string | null
  isAnonymous?: boolean
  hideFromPublic?: boolean
}

export type CurrencyCode = 'PKR' | 'USD'

export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function pkrToCents(amount: number): number {
  return toCents(amount)
}

export function currencySymbol(currency: CurrencyCode = 'PKR'): string {
  return currency === 'USD' ? 'USD' : 'PKR'
}

export function formatCurrencyAmount(
  cents: number,
  currency: CurrencyCode = 'PKR',
): string {
  const absVal = Math.abs(cents) / 100
  return absVal.toLocaleString(undefined, {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

export function formatCurrency(
  cents: number,
  currency: CurrencyCode = 'PKR',
): string {
  const isNegative = cents < 0
  const formattedAmount = formatCurrencyAmount(cents, currency)
  const prefix = isNegative ? '-' : ''
  const code = currency === 'USD' ? 'USD' : 'PKR'
  return `${prefix}${code} ${formattedAmount}`
}

export function formatPkrAmount(cents: number): string {
  return formatCurrencyAmount(cents, 'PKR')
}

export function formatPkr(cents: number): string {
  return formatCurrency(cents, 'PKR')
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
  const label = input.label.trim()
  const existing = await listLedgerCategories(db, input.orgId, true)
  const duplicate = existing.some(
    (c) => (c.label ?? '').trim().toLowerCase() === label.toLowerCase(),
  )
  if (duplicate) {
    throw new Error('That category already exists.')
  }
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  await db.execute(
    `INSERT INTO ledger_categories (id, org_id, label, direction, archived, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, input.orgId, label, input.direction, created_at],
  )
  return {
    id,
    org_id: input.orgId,
    label,
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

export async function setLedgerCategoryDirection(
  db: SanctuaryDb,
  id: string,
  direction: LedgerDirection,
): Promise<void> {
  await db.execute(`UPDATE ledger_categories SET direction = ? WHERE id = ?`, [
    direction,
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
  const currency: CurrencyCode = input.currency === 'USD' ? 'USD' : 'PKR'
  const isAnonymous =
    input.direction === 'in' && input.isAnonymous ? 1 : 0
  const hideFromPublic = input.hideFromPublic ? 1 : 0

  await db.execute(
    `INSERT INTO ledger_entries (
      id, org_id, category_id, direction, amount_cents, currency, entry_date, notes, animal_id, is_anonymous, hide_from_public, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.orgId,
      input.categoryId,
      input.direction,
      input.amountCents,
      currency,
      entry_date,
      input.notes?.trim() || null,
      input.animalId ?? null,
      isAnonymous,
      hideFromPublic,
      created_at,
    ],
  )

  return {
    id,
    org_id: input.orgId,
    category_id: input.categoryId,
    direction: input.direction,
    amount_cents: input.amountCents,
    currency,
    entry_date,
    notes: input.notes?.trim() || null,
    animal_id: input.animalId ?? null,
    is_anonymous: isAnonymous,
    hide_from_public: hideFromPublic,
    created_at,
  }
}

export async function getLedgerEntry(
  db: SanctuaryDb,
  id: string,
): Promise<(LedgerEntryRecord & { category_label?: string | null }) | null> {
  return db.getOptional(
    `SELECT e.*, c.label as category_label
     FROM ledger_entries e
     LEFT JOIN ledger_categories c ON c.id = e.category_id
     WHERE e.id = ?`,
    [id],
  )
}

export async function updateLedgerEntry(
  db: SanctuaryDb,
  id: string,
  input: UpdateLedgerEntryInput,
): Promise<void> {
  if (input.amountCents <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  const isAnonymous =
    input.direction === 'in' && input.isAnonymous ? 1 : 0
  const currency: CurrencyCode = input.currency === 'USD' ? 'USD' : 'PKR'
  const hideFromPublic =
    input.hideFromPublic === undefined
      ? ((await getLedgerEntry(db, id))?.hide_from_public ?? 0)
      : input.hideFromPublic
        ? 1
        : 0
  await db.execute(
    `UPDATE ledger_entries SET
      category_id = ?,
      direction = ?,
      amount_cents = ?,
      currency = ?,
      entry_date = ?,
      notes = ?,
      animal_id = ?,
      is_anonymous = ?,
      hide_from_public = ?
     WHERE id = ?`,
    [
      input.categoryId,
      input.direction,
      input.amountCents,
      currency,
      input.entryDate,
      input.notes?.trim() || null,
      input.animalId ?? null,
      isAnonymous,
      hideFromPublic,
      id,
    ],
  )
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
  const { deleteAttachmentsForEntry } = await import(
    '@/features/ledger/domain/attachments'
  )
  await deleteAttachmentsForEntry(db, id)
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

export type MonthlyLedgerPoint = {
  /** YYYY-MM */
  month: string
  inCents: number
  outCents: number
}

/** Last `months` calendar months (including current), oldest first. */
export async function sumLedgerByMonth(
  db: SanctuaryDb,
  orgId: string,
  months = 6,
): Promise<MonthlyLedgerPoint[]> {
  const now = new Date()
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    keys.push(`${y}-${m}`)
  }

  const from = `${keys[0]}-01`
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const to = end.toISOString().slice(0, 10)

  const rows = await db.getAll<{
    month: string
    direction: string
    total: number
  }>(
    `SELECT substr(entry_date, 1, 7) as month, direction, SUM(amount_cents) as total
     FROM ledger_entries
     WHERE org_id = ? AND entry_date >= ? AND entry_date <= ?
     GROUP BY month, direction`,
    [orgId, from, to],
  )

  const map = new Map<string, { inCents: number; outCents: number }>()
  for (const key of keys) {
    map.set(key, { inCents: 0, outCents: 0 })
  }
  for (const row of rows) {
    const bucket = map.get(row.month)
    if (!bucket) continue
    const total = Number(row.total) || 0
    if (row.direction === 'in') bucket.inCents = total
    if (row.direction === 'out') bucket.outCents = total
  }

  return keys.map((month) => ({
    month,
    inCents: map.get(month)?.inCents ?? 0,
    outCents: map.get(month)?.outCents ?? 0,
  }))
}
