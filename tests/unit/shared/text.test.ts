import { describe, it, expect } from 'vitest'
import { toSentenceCase } from '@/shared/lib/text'

describe('toSentenceCase', () => {
  it('capitalizes first letter and keeps rest lowercase', () => {
    expect(toSentenceCase('MEDICAL EMERGENCY')).toBe('Medical emergency')
    expect(toSentenceCase('animal cruelty')).toBe('Animal cruelty')
    expect(toSentenceCase('dog')).toBe('Dog')
    expect(toSentenceCase('DOG')).toBe('Dog')
  })

  it('converts underscores and hyphens into spaces in sentence case', () => {
    expect(toSentenceCase('in_treatment')).toBe('In treatment')
    expect(toSentenceCase('ready-for-adoption')).toBe('Ready for adoption')
  })

  it('handles null, undefined, and empty string gracefully', () => {
    expect(toSentenceCase(null)).toBe('')
    expect(toSentenceCase(undefined)).toBe('')
    expect(toSentenceCase('   ')).toBe('')
  })
})
