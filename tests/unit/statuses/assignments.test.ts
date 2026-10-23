import { describe, expect, it, vi } from 'vitest'
import {
  listAssignmentsForAnimal,
  resolvePrimaryStatusId,
  replaceAnimalStatuses,
  setSingleStatusAssignment,
} from '@/features/statuses/domain/assignments'
import * as checklistModule from '@/features/checklist/domain/checklist'

type Status = {
  id: string
  label: string
  sort_order: number
  counts_as_in_care: number
}

function createDb(statuses: Status[], primaryStatusId: string | null = null) {
  const execute = vi.fn().mockResolvedValue(undefined)
  const getAll = vi.fn(async (sql: string) => {
    if (sql.includes('FROM animal_statuses')) return statuses
    return []
  })
  const getOptional = vi.fn(async (sql: string) => {
    if (sql.includes('SELECT status_id FROM animals')) {
      return primaryStatusId ? { status_id: primaryStatusId } : null
    }
    return null
  })

  return {
    db: {
      getAll,
      getOptional,
      execute,
    },
    execute,
    getAll,
    getOptional,
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

  it('writes the first out-of-care status in provided order to animals.status_id', async () => {
    const { db, execute } = createDb([
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

    const statusUpdate = execute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE animals SET status_id'),
    )
    expect(statusUpdate).toBeDefined()
    expect(statusUpdate![1]).toEqual([
      'adopted',
      expect.any(String),
      'animal-1',
    ])
  })

  it('updates animals.status_id using resolvePrimaryStatusId', async () => {
    const { db, execute } = createDb([
      { id: 'watch', label: 'Watch', sort_order: 5, counts_as_in_care: 1 },
      { id: 'urgent', label: 'Urgent', sort_order: 1, counts_as_in_care: 1 },
    ])

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['watch', 'urgent'],
    })

    const statusUpdate = execute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE animals SET status_id'),
    )
    expect(statusUpdate).toBeDefined()
    expect(statusUpdate![1]).toEqual([
      'urgent',
      expect.any(String),
      'animal-1',
    ])
  })

  it('does nothing when animals.status_id is already unchanged', async () => {
    const { db, execute } = createDb(
      [
        { id: 'watch', label: 'Watch', sort_order: 5, counts_as_in_care: 1 },
        { id: 'urgent', label: 'Urgent', sort_order: 1, counts_as_in_care: 1 },
      ],
      'urgent',
    )

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-1',
      animalId: 'animal-1',
      statusIds: ['watch', 'urgent'],
    })

    expect(execute).not.toHaveBeenCalled()
  })

  it('writes care-log notes with the resolved primary status label', async () => {
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
      'Urgent',
      null,
      0,
      expect.any(String),
    ])
  })
})

describe('listAssignmentsForAnimal', () => {
  it('returns the animal status row joined from animals.status_id', async () => {
    const rows = [
      {
        status_id: 'urgent',
        label: 'Urgent',
        sort_order: 1,
        counts_as_in_care: 1,
      },
    ]
    const getAll = vi.fn().mockResolvedValue(rows)

    await expect(
      listAssignmentsForAnimal({ getAll } as never, 'animal-1'),
    ).resolves.toEqual(rows)

    expect(getAll).toHaveBeenCalledOnce()
    const [sql, params] = getAll.mock.calls[0]!
    expect(sql).toMatch(/FROM animals a/i)
    expect(sql).toMatch(/JOIN animal_statuses s ON s\.id = a\.status_id/i)
    expect(params).toEqual(['animal-1'])
  })
})

describe('checklist auto-add on status change', () => {
  it('automatically adds animal to checklist when single status is Critical or Treatment', async () => {
    const addChecklistSpy = vi
      .spyOn(checklistModule, 'addAnimalsToChecklist')
      .mockResolvedValue({ added: 1, skipped: 0 })

    const db = {
      execute: vi.fn().mockResolvedValue(undefined),
      getOptional: vi.fn().mockResolvedValue({ label: 'Critical' }),
    }

    await setSingleStatusAssignment(db as never, {
      animalId: 'anim-crit-1',
      orgId: 'org-test',
      statusId: 'status-crit',
    })

    expect(addChecklistSpy).toHaveBeenCalledWith(db, {
      orgId: 'org-test',
      animalIds: ['anim-crit-1'],
    })

    addChecklistSpy.mockRestore()
  })

  it('automatically adds animal to checklist when replaceAnimalStatuses resolves to Treatment or Critical', async () => {
    const addChecklistSpy = vi
      .spyOn(checklistModule, 'addAnimalsToChecklist')
      .mockResolvedValue({ added: 1, skipped: 0 })

    const { db } = createDb([
      { id: 'treat', label: 'Treatment', sort_order: 1, counts_as_in_care: 1 },
    ])

    await replaceAnimalStatuses(db as never, {
      orgId: 'org-test',
      animalId: 'anim-treat-1',
      statusIds: ['treat'],
    })

    expect(addChecklistSpy).toHaveBeenCalledWith(db, {
      orgId: 'org-test',
      animalIds: ['anim-treat-1'],
    })

    addChecklistSpy.mockRestore()
  })
})
