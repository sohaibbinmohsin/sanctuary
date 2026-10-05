import { describe, expect, it, vi } from 'vitest'
import {
  ensureDefaultLedgerCategories,
  listLedgerCategories,
} from '@/features/ledger/domain/ledger'

describe('ensureDefaultLedgerCategories', () => {
  it('returns existing categories without querying remote when present locally', async () => {
    const existing = [
      {
        id: 'c-1',
        org_id: 'org-1',
        label: 'Food',
        direction: 'out',
        archived: 0,
        created_at: new Date().toISOString(),
      },
    ]

    const db = {
      getAll: vi.fn().mockResolvedValue(existing),
      execute: vi.fn(),
      writeTransaction: vi.fn(),
      getOptional: vi.fn(),
    }

    const result = await listLedgerCategories(db as never, 'org-1')
    expect(result).toEqual(existing)
    expect(db.execute).not.toHaveBeenCalled()
  })

  it('inserts and returns default Food category when local and remote are empty', async () => {
    let storedCats: unknown[] = []
    const db = {
      getAll: vi.fn().mockImplementation(async () => storedCats),
      execute: vi.fn().mockImplementation(async (_sql: string, params: unknown[]) => {
        storedCats = [
          {
            id: params[0],
            org_id: params[1],
            label: 'Food',
            direction: 'out',
            archived: 0,
            created_at: params[2],
          },
        ]
      }),
      writeTransaction: vi.fn(),
      getOptional: vi.fn(),
    }

    const result = await ensureDefaultLedgerCategories(db as never, 'org-test')
    expect(result).toHaveLength(1)
    expect(result[0]!.label).toBe('Food')
    expect(result[0]!.direction).toBe('out')
  })
})
