import { describe, it, expect } from 'vitest'
import { orgInitials } from '@/shared/lib/ids/orgInitials'

describe('orgInitials', () => {
  it('takes first letter of each word', () => {
    expect(orgInitials('Tales of Second Chances')).toBe('TOSC')
  })
  it('uppercases and ignores extra spaces', () => {
    expect(orgInitials('  happy   paws  rescue ')).toBe('HPR')
  })
})
