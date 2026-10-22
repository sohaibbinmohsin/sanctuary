import { describe, it, expect } from 'vitest'
import { formatPhoneNumber, validatePhoneNumber } from '@/features/reports/domain/phone'

describe('phone domain utilities', () => {
  describe('formatPhoneNumber', () => {
    it('formats 11-digit Pakistan mobile numbers with a space after 4 digits', () => {
      expect(formatPhoneNumber('03001234567')).toBe('0300 1234567')
      expect(formatPhoneNumber('03219876543')).toBe('0321 9876543')
      expect(formatPhoneNumber('0300-1234567')).toBe('0300 1234567')
      expect(formatPhoneNumber('0300 1234567')).toBe('0300 1234567')
    })

    it('handles partial mobile numbers during typing', () => {
      expect(formatPhoneNumber('0300')).toBe('0300')
      expect(formatPhoneNumber('03001')).toBe('0300 1')
      expect(formatPhoneNumber('03')).toBe('03')
      expect(formatPhoneNumber('')).toBe('')
    })

    it('formats international numbers with +92 prefix cleanly', () => {
      expect(formatPhoneNumber('+923001234567')).toBe('+92 300 1234567')
      expect(formatPhoneNumber('+92 300 1234567')).toBe('+92 300 1234567')
    })

    it('formats local landline numbers starting with 021, 042, 051 etc.', () => {
      expect(formatPhoneNumber('02134567890')).toBe('021 34567890')
      expect(formatPhoneNumber('04235881234')).toBe('042 35881234')
      expect(formatPhoneNumber('0519201234')).toBe('051 9201234')
    })

    it('normalizes 10-digit Pakistan mobile numbers missing the leading zero', () => {
      expect(formatPhoneNumber('3244317495')).toBe('0324 4317495')
      expect(formatPhoneNumber('3006880426')).toBe('0300 6880426')
      expect(formatPhoneNumber('3128144866')).toBe('0312 8144866')
    })
  })

  describe('validatePhoneNumber', () => {
    it('considers empty or whitespace phone as valid since phone is optional', () => {
      expect(validatePhoneNumber('')).toEqual({ isValid: true })
      expect(validatePhoneNumber('   ')).toEqual({ isValid: true })
    })

    it('validates a correct 11-digit mobile number', () => {
      expect(validatePhoneNumber('0300-1234567')).toEqual({ isValid: true })
      expect(validatePhoneNumber('03001234567')).toEqual({ isValid: true })
      expect(validatePhoneNumber('+92 300 1234567')).toEqual({ isValid: true })
    })

    it('rejects numbers that are too short', () => {
      const res = validatePhoneNumber('0300-123')
      expect(res.isValid).toBe(false)
      expect(res.error).toBeDefined()
    })

    it('rejects numbers containing letters or invalid characters', () => {
      const res = validatePhoneNumber('0300-1234abc')
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('invalid')
    })
  })
})
