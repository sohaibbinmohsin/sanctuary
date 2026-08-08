import { describe, expect, it, vi } from 'vitest'
import { searchAnimals } from '@/features/animals/domain/animals'

describe('searchAnimals', () => {
  it('uses valid SQLite string literals for name search', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const db = { getAll } as never

    await searchAnimals(db, 'org-1', { query: 'tillu' })

    expect(getAll).toHaveBeenCalledOnce()
    const [sql, params] = getAll.mock.calls[0]!
    expect(sql).toContain("IFNULL(a.name, '')")
    expect(sql).not.toContain('IFNULL(a.name, "")')
    expect(params).toEqual(['org-1', '%tillu%', '%tillu%'])
  })

  it('filters by status id and partial species', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const db = { getAll } as never

    await searchAnimals(db, 'org-1', {
      statusId: 'status-q',
      species: 'dog',
    })

    const [sql, params] = getAll.mock.calls[0]!
    expect(sql).toContain('a.status_id = ?')
    expect(sql).toContain('LOWER(a.species) LIKE LOWER(?)')
    expect(params).toEqual(['org-1', 'status-q', '%dog%'])
  })
})
