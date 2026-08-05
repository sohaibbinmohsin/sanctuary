import { describe, it, expect, vi } from 'vitest'
import { nextShelterId } from '@/shared/lib/ids/shelterId'

describe('createAnimal shelter allocation helper', () => {
  it('uses nextShelterId against mocked existing codes', () => {
    const getAll = vi.fn().mockResolvedValue([
      { shelter_code: 'TOSC-0001' },
      { shelter_code: 'TOSC-0007' },
    ])
    const codes = [
      { shelter_code: 'TOSC-0001' },
      { shelter_code: 'TOSC-0007' },
    ]
    expect(nextShelterId('TOSC', codes.map((c) => c.shelter_code))).toBe(
      'TOSC-0008',
    )
    expect(getAll).not.toHaveBeenCalled()
  })
})
