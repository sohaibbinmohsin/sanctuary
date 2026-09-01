import { describe, expect, it, vi } from 'vitest'
import {
  addLedgerEntry,
  currencySymbol,
  formatCurrency,
  formatCurrencyAmount,
  formatPkr,
  formatPkrAmount,
  pkrToCents,
  sumLedger,
  sumLedgerByMonth,
  toCents,
  type AddLedgerEntryInput,
} from '@/features/ledger/domain/ledger'
import type { SanctuaryDb } from '@/shared/lib/db'

describe('currency domain formatting and conversion', () => {
  it('converts decimal amounts to integer cents', () => {
    expect(toCents(10)).toBe(1000)
    expect(toCents(10.5)).toBe(1050)
    expect(toCents(10.55)).toBe(1055)
    expect(pkrToCents(50)).toBe(5000)
  })

  it('returns appropriate currency symbol (text-based for both)', () => {
    expect(currencySymbol('PKR')).toBe('PKR')
    expect(currencySymbol('USD')).toBe('USD')
    expect(currencySymbol()).toBe('PKR')
  })

  it('formats PKR amounts with PKR prefix and optional decimals', () => {
    expect(formatCurrency(500000, 'PKR')).toBe('PKR 5,000')
    expect(formatCurrency(500050, 'PKR')).toBe('PKR 5,000.5')
    expect(formatCurrency(500055, 'PKR')).toBe('PKR 5,000.55')
    expect(formatCurrency(0, 'PKR')).toBe('PKR 0')
    expect(formatCurrency(-25000, 'PKR')).toBe('-PKR 250')
    expect(formatPkr(500000)).toBe('PKR 5,000')
    expect(formatPkrAmount(500000)).toBe('5,000')
  })

  it('formats USD amounts with USD prefix and 2 decimal places', () => {
    expect(formatCurrency(500000, 'USD')).toBe('USD 5,000.00')
    expect(formatCurrency(500050, 'USD')).toBe('USD 5,000.50')
    expect(formatCurrency(500055, 'USD')).toBe('USD 5,000.55')
    expect(formatCurrency(0, 'USD')).toBe('USD 0.00')
    expect(formatCurrency(-25000, 'USD')).toBe('-USD 250.00')
    expect(formatCurrencyAmount(500000, 'USD')).toBe('5,000.00')
  })

  it('saves entry currency on addLedgerEntry', async () => {
    const executedSql: { sql: string; params?: unknown[] }[] = []
    const mockDb = {
      execute: vi.fn(async (sql, params) => {
        executedSql.push({ sql, params })
      }),
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(),
    } as unknown as SanctuaryDb

    const input: AddLedgerEntryInput = {
      orgId: 'org-1',
      categoryId: 'cat-1',
      direction: 'in',
      amountCents: 5000,
      currency: 'USD',
      entryDate: '2026-09-01',
    }

    const entry = await addLedgerEntry(mockDb, input)
    expect(entry.currency).toBe('USD')
    expect(
      executedSql.some(
        (e) =>
          e.sql.includes('INSERT INTO ledger_entries') &&
          e.params?.includes('USD'),
      ),
    ).toBe(true)
  })

  it('computes sumLedger for an org', async () => {
    const mockDb = {
      execute: vi.fn(async () => {}),
      getAll: vi.fn(async (sql, params) => {
        expect(sql).toContain('org_id = ?')
        expect(params).toEqual(['org-1'])
        return [
          { direction: 'in', total: 10000 },
          { direction: 'out', total: 4000 },
        ]
      }),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(),
    } as unknown as SanctuaryDb

    const totals = await sumLedger(mockDb, 'org-1')
    expect(totals).toEqual({ inCents: 10000, outCents: 4000 })
  })

  it('computes sumLedgerByMonth for an org', async () => {
    const mockDb = {
      execute: vi.fn(async () => {}),
      getAll: vi.fn(async (sql, params) => {
        expect(sql).toContain('org_id = ?')
        expect(params?.[0]).toBe('org-1')
        return []
      }),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(),
    } as unknown as SanctuaryDb

    const result = await sumLedgerByMonth(mockDb, 'org-1', 6)
    expect(result.length).toBe(6)
  })
})
