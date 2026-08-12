import { describe, expect, it, vi } from 'vitest'
import {
  resolvePrimaryStatusId,
  replaceAnimalStatuses,
} from '@/features/statuses/domain/assignments'

describe('resolvePrimaryStatusId', () => {
  it('prefers out-of-care over in-care', () => {
    expect(
      resolvePrimaryStatusId([
        { id: 'c', sort_order: 1, counts_as_in_care: 1, label: 'Critical' },
        { id: 'a', sort_order: 9, counts_as_in_care: 0, label: 'Adopted' },
      ]),
    ).toBe('a')
  })

  it('picks lowest sort_order among in-care', () => {
    expect(
      resolvePrimaryStatusId([
        { id: 'b', sort_order: 2, counts_as_in_care: 1, label: 'B' },
        { id: 'a', sort_order: 1, counts_as_in_care: 1, label: 'A' },
      ]),
    ).toBe('a')
  })
})

describe('replaceAnimalStatuses', () => {
  it('rejects empty status set', async () => {
    const db = {
      writeTransaction: vi.fn(),
      getAll: vi.fn(),
      getOptional: vi.fn(),
      execute: vi.fn(),
    }
    await expect(
      replaceAnimalStatuses(db as never, {
        orgId: 'o',
        animalId: 'a',
        statusIds: [],
      }),
    ).rejects.toThrow(/at least one status/i)
  })

  it('when any out-of-care id present, writes only that exit assignment', async () => {
    const executes: unknown[] = []
    const execute = vi.fn(async (...args: unknown[]) => {
      executes.push(args)
    })
    const db = {
      getAll: vi.fn(async (sql: string) => {
        if (sql.includes('FROM animal_statuses')) {
          return [
            {
              id: 'crit',
              label: 'Critical',
              sort_order: 1,
              counts_as_in_care: 1,
            },
            {
              id: 'adopt',
              label: 'Adopted',
              sort_order: 9,
              counts_as_in_care: 0,
            },
          ]
        }
        if (sql.includes('FROM animal_status_assignments')) {
          return [{ status_id: 'crit' }]
        }
        return []
      }),
      getOptional: vi.fn(async () => ({ org_id: 'o' })),
      writeTransaction: async (
        fn: (tx: { execute: typeof execute }) => Promise<void>,
      ) => {
        await fn({ execute })
      },
      execute,
    }

    await replaceAnimalStatuses(db as never, {
      orgId: 'o',
      animalId: 'a1',
      statusIds: ['crit', 'adopt'],
    })

    const assignmentInserts = executes.filter((e) =>
      String((e as unknown[])[0]).includes(
        'INSERT INTO animal_status_assignments',
      ),
    )
    expect(assignmentInserts.length).toBe(1)
    expect((assignmentInserts[0] as unknown[])[1]).toEqual(
      expect.arrayContaining(['a1', 'adopt']),
    )
  })
})
