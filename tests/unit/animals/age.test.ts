import { describe, expect, it } from 'vitest'
import { assertAnimalAge, formatAgePhrase } from '@/features/animals/domain/age'

describe('formatAgePhrase', () => {
  it('treats empty age as unknown', () => {
    expect(formatAgePhrase(null, null)).toBeNull()
    expect(formatAgePhrase(undefined, undefined)).toBeNull()
  })

  it('formats the census phrases', () => {
    expect(formatAgePhrase(2, 0)).toBe('2 years')
    expect(formatAgePhrase(0, 6)).toBe('6 months')
    expect(formatAgePhrase(2, 6)).toBe('2 years 6 months')
  })

  it('uses singular units for a count of 1', () => {
    expect(formatAgePhrase(1, 0)).toBe('1 year')
    expect(formatAgePhrase(0, 1)).toBe('1 month')
    expect(formatAgePhrase(1, 1)).toBe('1 year 1 month')
  })

  it('shows a saved zero as 0 months, not unknown', () => {
    expect(formatAgePhrase(0, 0)).toBe('0 months')
  })

  it('hides a pair outside the wheels', () => {
    expect(formatAgePhrase(21, 0)).toBeNull()
    expect(formatAgePhrase(2, 12)).toBeNull()
    expect(formatAgePhrase(1.5, 0)).toBeNull()
  })

  it('treats a missing half as zero when the other half is set', () => {
    expect(formatAgePhrase(2, null)).toBe('2 years')
    expect(formatAgePhrase(null, 6)).toBe('6 months')
  })
})

describe('assertAnimalAge', () => {
  it('accepts the wheel bounds', () => {
    expect(() => assertAnimalAge(0, 0)).not.toThrow()
    expect(() => assertAnimalAge(20, 11)).not.toThrow()
  })

  it('rejects years outside 0 to 20', () => {
    expect(() => assertAnimalAge(21, 0)).toThrow(
      'Years must be a whole number from 0 to 20.',
    )
    expect(() => assertAnimalAge(-1, 0)).toThrow(
      'Years must be a whole number from 0 to 20.',
    )
    expect(() => assertAnimalAge(1.5, 0)).toThrow(
      'Years must be a whole number from 0 to 20.',
    )
  })

  it('rejects months outside 0 to 11', () => {
    expect(() => assertAnimalAge(0, 12)).toThrow(
      'Months must be a whole number from 0 to 11.',
    )
  })
})