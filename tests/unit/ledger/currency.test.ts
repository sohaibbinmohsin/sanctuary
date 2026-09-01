import { describe, expect, it } from 'vitest'
import {
  currencySymbol,
  formatCurrency,
  formatCurrencyAmount,
  formatPkr,
  formatPkrAmount,
  pkrToCents,
  toCents,
} from '@/features/ledger/domain/ledger'

describe('currency domain formatting and conversion', () => {
  it('converts decimal amounts to integer cents', () => {
    expect(toCents(10)).toBe(1000)
    expect(toCents(10.5)).toBe(1050)
    expect(toCents(10.55)).toBe(1055)
    expect(pkrToCents(50)).toBe(5000)
  })

  it('returns appropriate currency symbol', () => {
    expect(currencySymbol('PKR')).toBe('PKR')
    expect(currencySymbol('USD')).toBe('$')
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

  it('formats USD amounts with $ prefix and 2 decimal places', () => {
    expect(formatCurrency(500000, 'USD')).toBe('$5,000.00')
    expect(formatCurrency(500050, 'USD')).toBe('$5,000.50')
    expect(formatCurrency(500055, 'USD')).toBe('$5,000.55')
    expect(formatCurrency(0, 'USD')).toBe('$0.00')
    expect(formatCurrency(-25000, 'USD')).toBe('-$250.00')
    expect(formatCurrencyAmount(500000, 'USD')).toBe('5,000.00')
  })
})
