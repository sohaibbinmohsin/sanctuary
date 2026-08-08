import { describe, it, expect } from 'vitest'
import { formatShelterId, nextShelterId } from '@/shared/lib/ids/shelterId'

describe('shelterId', () => {
  it('zero-pads to 4 digits', () => {
    expect(formatShelterId('TOSC', 42)).toBe('TOSC-0042')
  })
  it('allocates next sequence from existing codes', () => {
    expect(nextShelterId('TOSC', ['TOSC-0001', 'TOSC-0003'])).toBe('TOSC-0004')
  })
  it('starts at 0001 when empty', () => {
    expect(nextShelterId('TOSC', [])).toBe('TOSC-0001')
  })
})
