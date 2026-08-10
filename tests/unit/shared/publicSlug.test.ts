import { describe, it, expect } from 'vitest'
import {
  normalizePublicSlug,
  isReservedPublicSlug,
  isValidPublicSlugFormat,
  defaultPublicSlug,
  publicShelterPath,
} from '@/shared/lib/public/slug'

describe('public slug', () => {
  it('normalizes to lowercase kebab', () => {
    expect(normalizePublicSlug('  ToSc Shelter ')).toBe('tosc-shelter')
  })

  it('rejects reserved paths', () => {
    expect(isReservedPublicSlug('login')).toBe(true)
    expect(isReservedPublicSlug('animals')).toBe(true)
    expect(isReservedPublicSlug('tosc')).toBe(false)
  })

  it('validates format', () => {
    expect(isValidPublicSlugFormat('tosc')).toBe(true)
    expect(isValidPublicSlugFormat('tales-of-second-chances')).toBe(true)
    expect(isValidPublicSlugFormat('ab')).toBe(false) // min 3
    expect(isValidPublicSlugFormat('-tosc')).toBe(false)
  })

  it('defaults from initials when available', () => {
    expect(defaultPublicSlug('Tales of Second Chances', 'TOSC')).toBe('tosc')
  })

  it('builds path', () => {
    expect(publicShelterPath('tosc')).toBe('/tosc')
  })
})
