import { describe, it, expect } from 'vitest'
import { formatCnic, validateCnic } from '@/features/reports/domain/cnic'

describe('CNIC domain helpers', () => {
  describe('formatCnic', () => {
    it('returns empty string for falsy input', () => {
      expect(formatCnic('')).toBe('')
      expect(formatCnic(null)).toBe('')
      expect(formatCnic(undefined)).toBe('')
    })

    it('formats 13 digits into standard XXXXX-XXXXXXX-X format', () => {
      expect(formatCnic('4210112345671')).toBe('42101-1234567-1')
    })

    it('formats partial input during typing', () => {
      expect(formatCnic('42101')).toBe('42101')
      expect(formatCnic('421011')).toBe('42101-1')
      expect(formatCnic('421011234567')).toBe('42101-1234567')
      expect(formatCnic('42101-1234567')).toBe('42101-1234567')
      expect(formatCnic('42101-1234567-1')).toBe('42101-1234567-1')
    })

    it('limits to 13 digits', () => {
      expect(formatCnic('42101123456719999')).toBe('42101-1234567-1')
    })
  })

  describe('validateCnic', () => {
    it('treats empty as valid (optional field)', () => {
      expect(validateCnic('')).toEqual({ isValid: true })
      expect(validateCnic('   ')).toEqual({ isValid: true })
      expect(validateCnic(null)).toEqual({ isValid: true })
    })

    it('validates 13 digit CNIC with or without dashes', () => {
      expect(validateCnic('42101-1234567-1')).toEqual({ isValid: true })
      expect(validateCnic('4210112345671')).toEqual({ isValid: true })
    })

    it('returns error if digits count is not 13', () => {
      const res = validateCnic('42101-123')
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('13 digits')
    })
  })
})
