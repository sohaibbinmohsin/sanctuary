import { describe, it, expect } from 'vitest'
import {
  formatPublicWhen,
  publicCareLabel,
} from '@/shared/lib/public/format'

describe('formatPublicWhen', () => {
  it('formats date-only values without a clock time', () => {
    const formatted = formatPublicWhen('2026-08-08')
    expect(formatted).toMatch(/8/)
    expect(formatted).toMatch(/2026/)
    expect(formatted).not.toMatch(/T/)
  })

  it('formats full timestamps with a readable date and time', () => {
    const formatted = formatPublicWhen('2026-08-10T14:16:11.359+00:00')
    expect(formatted).toMatch(/2026/)
    expect(formatted).not.toContain('T14:16')
    expect(formatted).not.toContain('+00:00')
  })
})

describe('publicCareLabel', () => {
  it('maps system care types to friendly labels', () => {
    expect(publicCareLabel('arrived')).toBe('Arrived')
    expect(publicCareLabel('intake')).toBe('Arrived')
    expect(publicCareLabel('status')).toBe('Status')
  })
})
