import { describe, expect, it, vi } from 'vitest'
import {
  listAssignmentsForAnimal,
  resolvePrimaryStatusId,
  replaceAnimalStatuses,
} from '@/features/statuses/domain/assignments'

type Status = {
  id: string
  label: string
  sort_order: number
  counts_as_in_care: number
}

function createDb(
  statuses: Status[],
  currentStatusIds: string[] = [],
  primaryStatusId?: string,
) {
  const transactionExecute = vi.fn().mockResolvedValue(undefined)
  const execute = vi.fn().mockResolvedValue(undefined)
  const getAll = vi.fn(async (sql: string) => {
    if (sql.includes('FROM animal_statuses')) return statuses
    if (sql.includes('FROM animal_status_assignments')) {
      return currentStatusIds.map((status_id) => ({
        status_id,
        primary_status_id: primaryStatusId,
      }))
    }
    return []
  })
  const writeTransaction = vi.fn(
    async (
      fn: (tx: { execute: typeof transactionExecute }) => Promise<void>,
    ) => {
      await fn({ execute: transactionExecute })
    },
  )

  return {
    db: {
      getAll,
      getOptional: vi.fn(),
      execute,
      writeTransaction,
    },
    execute,
    getAll,
    transactionExecute,
    writeTransaction,
  }
}

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

  it('writes only the first out-of-care status in provided order', async () => {
    const { db, transactionExecute } = createDb([
      {
        id: 'transfer',
        label: 'Transferred',
        sort_order: 8,
        counts_as_in_care: 0,
      },
      {
        id: 'critical',
        label: 'Critical',
        sort_order: 1,
        counts_as_in_care: 1,
      },
      {
        id: 'adopted',
        label: 'Adopted',
        sort_order: 9,
        counts_as_in_care: 0,
      },
    ])

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['critical', 'adopted', 'transfer'],
    })

    const assignmentInserts = transactionExecute.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO animal_status_assignments'),
    )
    expect(assignmentInserts).toHaveLength(1)
    expect(assignmentInserts[0]![1]).toEqual(
      expect.arrayContaining(['animal-1', 'adopted']),
    )
  })

  it('updates the primary mirror using resolvePrimaryStatusId', async () => {
    const { db, transactionExecute } = createDb([
      { id: 'watch', label: 'Watch', sort_order: 5, counts_as_in_care: 1 },
      { id: 'urgent', label: 'Urgent', sort_order: 1, counts_as_in_care: 1 },
    ])

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['watch', 'urgent'],
    })

    const mirrorUpdate = transactionExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE animals SET status_id'),
    )
    expect(mirrorUpdate).toBeDefined()
    expect(mirrorUpdate![1]).toEqual([
      'urgent',
      expect.any(String),
      'animal-1',
    ])
  })

  it('repairs the primary mirror when reordered assignments are unchanged', async () => {
    const { db, execute, transactionExecute, writeTransaction } = createDb(
      [
        { id: 'watch', label: 'Watch', sort_order: 5, counts_as_in_care: 1 },
        { id: 'urgent', label: 'Urgent', sort_order: 1, counts_as_in_care: 1 },
      ],
      ['urgent', 'watch'],
      'watch',
    )

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['watch', 'urgent'],
    })

    expect(writeTransaction).not.toHaveBeenCalled()
    expect(transactionExecute).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]![0]).toContain(
      'UPDATE animals SET status_id',
    )
    expect(execute.mock.calls[0]![1]).toEqual([
      'urgent',
      expect.any(String),
      'animal-1',
    ])
  })

  it('does nothing when assignments and the primary mirror are unchanged', async () => {
    const { db, execute, transactionExecute, writeTransaction } = createDb(
      [
        { id: 'watch', label: 'Watch', sort_order: 5, counts_as_in_care: 1 },
        { id: 'urgent', label: 'Urgent', sort_order: 1, counts_as_in_care: 1 },
      ],
      ['urgent', 'watch'],
      'urgent',
    )

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['watch', 'urgent'],
    })

    expect(writeTransaction).not.toHaveBeenCalled()
    expect(transactionExecute).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('writes care-log notes with labels sorted by sort_order', async () => {
    const { db, execute } = createDb([
      { id: 'stable', label: 'Stable', sort_order: 30, counts_as_in_care: 1 },
      { id: 'urgent', label: 'Urgent', sort_order: 10, counts_as_in_care: 1 },
      { id: 'watch', label: 'Watch', sort_order: 20, counts_as_in_care: 1 },
    ])

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['stable', 'urgent', 'watch'],
    })

    const treatmentInsert = execute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO treatments'),
    )
    expect(treatmentInsert).toBeDefined()
    expect(treatmentInsert![1]).toEqual([
      expect.any(String),
      'org-1',
      'animal-1',
      expect.any(String),
      'status',
      'Urgent, Watch, Stable',
      null,
      0,
      expect.any(String),
    ])
  })

  it('preserves all in-care statuses when no exit is present', async () => {
    const { db, transactionExecute } = createDb([
      { id: 'stable', label: 'Stable', sort_order: 30, counts_as_in_care: 1 },
      { id: 'urgent', label: 'Urgent', sort_order: 10, counts_as_in_care: 1 },
      { id: 'watch', label: 'Watch', sort_order: 20, counts_as_in_care: 1 },
    ])

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['stable', 'urgent', 'watch'],
    })

    const insertedStatusIds = transactionExecute.mock.calls
      .filter(([sql]) =>
        String(sql).includes('INSERT INTO animal_status_assignments'),
      )
      .map(([, params]) => params[3])
    expect(insertedStatusIds).toEqual(['stable', 'urgent', 'watch'])
  })
})

describe('listAssignmentsForAnimal', () => {
  it('returns ordered status join rows', async () => {
    const rows = [
      {
        status_id: 'urgent',
        label: 'Urgent',
        sort_order: 1,
        counts_as_in_care: 1,
      },
      {
        status_id: 'watch',
        label: 'Watch',
        sort_order: 2,
        counts_as_in_care: 1,
      },
    ]
    const getAll = vi.fn().mockResolvedValue(rows)

    await expect(
      listAssignmentsForAnimal({ getAll } as never, 'animal-1'),
    ).resolves.toEqual(rows)

    expect(getAll).toHaveBeenCalledOnce()
    const [sql, params] = getAll.mock.calls[0]!
    expect(sql).toMatch(/FROM animal_status_assignments asa/i)
    expect(sql).toMatch(/JOIN animal_statuses s ON s\.id = asa\.status_id/i)
    expect(sql).toMatch(/ORDER BY s\.sort_order ASC, s\.label ASC/i)
    expect(params).toEqual(['animal-1'])
  })

  it('falls back to animals.status_id and backfills when assignments are empty', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const getOptional = vi
      .fn()
      .mockResolvedValueOnce({ org_id: 'org-1', status_id: 'crit' })
      .mockResolvedValueOnce({
        id: 'crit',
        label: 'Critical',
        sort_order: 1,
        counts_as_in_care: 1,
      })
    const execute = vi.fn().mockResolvedValue(undefined)

    await expect(
      listAssignmentsForAnimal(
        { getAll, getOptional, execute } as never,
        'animal-1',
      ),
    ).resolves.toEqual([
      {
        status_id: 'crit',
        label: 'Critical',
        sort_order: 1,
        counts_as_in_care: 1,
      },
    ])

    expect(execute).toHaveBeenCalledOnce()
    const [sql, params] = execute.mock.calls[0]!
    expect(sql).toMatch(/INSERT OR IGNORE INTO animal_status_assignments/i)
    expect(params).toEqual(
      expect.arrayContaining(['org-1', 'animal-1', 'crit']),
    )
  })
})
