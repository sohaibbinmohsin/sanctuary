import { describe, expect, it, vi } from 'vitest'
import { countInCare } from '@/features/animals/domain/animals'

describe('countInCare', () => {
  it('counts non-archived animals whose status counts_as_in_care = 1', async () => {
    const getOptional = vi.fn().mockResolvedValue({ n: 12 })
    const db = { getOptional } as never

    await expect(countInCare(db, 'org-1')).resolves.toBe(12)

    const [sql, params] = getOptional.mock.calls[0]!
    expect(sql).toMatch(/JOIN animal_statuses s ON s\.id = a\.status_id/i)
    expect(sql).toMatch(/counts_as_in_care\s*=\s*1/i)
    expect(params).toEqual(['org-1'])
  })
})
