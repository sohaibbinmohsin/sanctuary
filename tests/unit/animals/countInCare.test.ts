import { describe, expect, it, vi } from 'vitest'
import { countInCare } from '@/features/animals/domain/animals'

describe('countInCare', () => {
  it('uses exit-wins SQL (in-care assignment and no out-of-care)', async () => {
    const getOptional = vi.fn().mockResolvedValue({ n: 12 })
    const db = { getOptional } as never

    await expect(countInCare(db, 'org-1')).resolves.toBe(12)

    const [sql, params] = getOptional.mock.calls[0]!
    expect(sql).toMatch(/counts_as_in_care\s*=\s*1/i)
    expect(sql).toMatch(/counts_as_in_care\s*=\s*0/i)
    expect(sql).toMatch(/NOT EXISTS|LEFT JOIN/i)
    expect(params).toEqual(['org-1'])
  })
})
