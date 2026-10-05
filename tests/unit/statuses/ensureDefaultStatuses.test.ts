import { describe, expect, it, vi } from 'vitest'
import {
  ensureDefaultStatuses,
  listStatuses,
} from '@/features/statuses/domain/statuses'

describe('ensureDefaultStatuses', () => {
  it('returns existing statuses without querying remote when present locally', async () => {
    const existing = [
      {
        id: 's-1',
        org_id: 'org-1',
        label: 'Intake',
        sort_order: 1,
        counts_as_in_care: 1,
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

    const result = await listStatuses(db as never, 'org-1')
    expect(result).toEqual(existing)
    expect(db.execute).not.toHaveBeenCalled()
  })

  it('inserts and returns default Intake status when local and remote are empty', async () => {
    let storedStatuses: unknown[] = []
    const db = {
      getAll: vi.fn().mockImplementation(async () => storedStatuses),
      execute: vi.fn().mockImplementation(async (_sql: string, params: unknown[]) => {
        storedStatuses = [
          {
            id: params[0],
            org_id: params[1],
            label: 'Intake',
            sort_order: 1,
            counts_as_in_care: 1,
            archived: 0,
            created_at: params[2],
          },
        ]
      }),
      writeTransaction: vi.fn(),
      getOptional: vi.fn(),
    }

    const result = await ensureDefaultStatuses(db as never, 'org-test')
    expect(result).toHaveLength(1)
    expect(result[0]!.label).toBe('Intake')
    expect(result[0]!.counts_as_in_care).toBe(1)
  })
})
