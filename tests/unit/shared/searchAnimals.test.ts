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

  it('filters match any selected statuses via animals.status_id', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const db = { getAll } as never

    await searchAnimals(db, 'org-1', {
      statusIds: ['s1', 's2'],
      statusMode: 'any',
    })

    const [sql, params] = getAll.mock.calls[0]!
    expect(sql).toMatch(/a\.status_id\s+IN\s*\(/i)
    expect(params).toEqual(expect.arrayContaining(['org-1', 's1', 's2']))
  })

  it('filters single selected status in all mode via animals.status_id', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const db = { getAll } as never

    await searchAnimals(db, 'org-1', {
      statusIds: ['s1'],
      statusMode: 'all',
    })

    const [sql, params] = getAll.mock.calls[0]!
    expect(sql).toContain('a.status_id IN (?)')
    expect(params).toEqual(['org-1', 's1'])
  })

  it('returns impossible predicate when multiple distinct statuses requested in all mode', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const db = { getAll } as never

    await searchAnimals(db, 'org-1', {
      statusIds: ['s1', 's2'],
      statusMode: 'all',
    })

    const [sql] = getAll.mock.calls[0]!
    expect(sql).toContain('1 = 0')
  })

  it('filters unknown sex with blank/null values', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const db = { getAll } as never

    await searchAnimals(db, 'org-1', { sex: '__unknown__' })

    const [sql, params] = getAll.mock.calls[0]!
    expect(sql).toContain("a.sex IS NULL OR TRIM(IFNULL(a.sex, '')) = ''")
    expect(params).toEqual(['org-1'])
  })
})
