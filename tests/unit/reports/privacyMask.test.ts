import { describe, it, expect } from 'vitest'
import { maskPhoneNumber, maskCnic } from '@/features/reports/domain/privacyMask'

describe('privacyMask', () => {
  it('masks pakistani mobile phone number showing only first 4 and last 3 digits', () => {
    expect(maskPhoneNumber('0300 1234567')).toBe('0300 ···· 567')
    expect(maskPhoneNumber('03211234567')).toBe('0321 ···· 567')
  })

  it('handles empty or short phone gracefully', () => {
    expect(maskPhoneNumber('')).toBe('')
    expect(maskPhoneNumber(null)).toBe('')
  })

  it('masks 13-digit CNIC showing prefix and suffix', () => {
    expect(maskCnic('42101-1234567-1')).toBe('42101-·······-1')
    expect(maskCnic('4210112345671')).toBe('42101-·······-1')
  })

  it('contains no em-dashes in masked output', () => {
    expect(maskPhoneNumber('0300 1234567')).not.toContain('\u2014')
    expect(maskCnic('42101-1234567-1')).not.toContain('\u2014')
  })
})
