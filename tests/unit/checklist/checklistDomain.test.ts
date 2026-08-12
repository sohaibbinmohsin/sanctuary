import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addAnimalsToChecklist,
  countChecklistOverdue,
  listChecklist,
  removeChecklistItemForAnimal,
  removeFromChecklist,
  setChecklistChecked,
} from '@/features/checklist/domain/checklist'

const randomUUID = vi.fn()

beforeEach(() => {
  randomUUID.mockReset()
  randomUUID
    .mockReturnValueOnce('new-item')
    .mockReturnValueOnce('new-check')
  vi.stubGlobal('crypto', { randomUUID })
})

describe('checklist domain', () => {
  it('addAnimalsToChecklist skips duplicates', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getAll = vi.fn().mockResolvedValue([{ animal_id: 'a1' }])
    const db = { execute, getAll }

    await expect(
      addAnimalsToChecklist(db as never, {
        orgId: 'org-1',
        animalIds: ['a1', 'a2'],
        addedBy: 'user-1',
      }),
    ).resolves.toEqual({ added: 1, skipped: 1 })

    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]![0]).toContain('INSERT INTO checklist_items')
    expect(execute.mock.calls[0]![1]).toEqual([
      'new-item',
      'org-1',
      'a2',
      expect.any(String),
      'user-1',
    ])
  })

  it('deduplicates repeated animal ids in one request', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getAll = vi.fn().mockResolvedValue([])

    await expect(
      addAnimalsToChecklist({ execute, getAll } as never, {
        orgId: 'org-1',
        animalIds: ['a2', 'a2'],
      }),
    ).resolves.toEqual({ added: 1, skipped: 1 })
    expect(execute).toHaveBeenCalledOnce()
  })

  it('sets and clears today check idempotently', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getOptional = vi.fn().mockResolvedValue(null)
    const db = { execute, getOptional }

    await setChecklistChecked(db as never, {
      orgId: 'org-1',
      animalId: 'a1',
      checked: true,
      today: '2026-08-12',
      checkedBy: 'user-1',
    })
    expect(getOptional).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM checklist_checks'),
      ['org-1', 'a1', '2026-08-12'],
    )
    expect(execute.mock.calls[0]![0]).toContain('INSERT INTO checklist_checks')
    expect(execute.mock.calls[0]![1]).toEqual([
      'new-item',
      'org-1',
      'a1',
      '2026-08-12',
      expect.any(String),
      'user-1',
    ])

    await setChecklistChecked(db as never, {
      orgId: 'org-1',
      animalId: 'a1',
      checked: false,
      today: '2026-08-12',
    })
    expect(execute.mock.calls[1]).toEqual([
      expect.stringContaining('DELETE FROM checklist_checks'),
      ['org-1', 'a1', '2026-08-12'],
    ])
  })

  it('updates an existing daily check instead of duplicating it', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getOptional = vi.fn().mockResolvedValue({ id: 'check-1' })

    await setChecklistChecked({ execute, getOptional } as never, {
      orgId: 'org-1',
      animalId: 'a1',
      checked: true,
      today: '2026-08-12',
      checkedBy: 'user-1',
    })

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE checklist_checks'),
      [expect.any(String), 'user-1', 'check-1'],
    )
  })

  it('removes an item within its organization', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await removeFromChecklist({ execute } as never, {
      orgId: 'org-1',
      animalId: 'a1',
    })
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM checklist_items'),
      ['org-1', 'a1'],
    )
  })

  it('removes checklist items for an animal across orgs', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await removeChecklistItemForAnimal({ execute } as never, 'a1')
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM checklist_items WHERE animal_id'),
      ['a1'],
    )
  })

  it('merges animals, checks, and missed streaks', async () => {
    const getAll = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'a1',
          org_id: 'org-1',
          shelter_code: 'SAN-001',
          name: 'Milo',
          species: 'Cat',
          added_at: '2026-08-08T09:00:00.000Z',
          added_by: null,
        },
        {
          id: 'a2',
          org_id: 'org-1',
          shelter_code: 'SAN-002',
          name: null,
          species: 'Dog',
          added_at: '2026-08-10T09:00:00.000Z',
          added_by: null,
        },
      ])
      .mockResolvedValueOnce([
        { animal_id: 'a1', check_date: '2026-08-12' },
        { animal_id: 'a1', check_date: '2026-08-11' },
        { animal_id: 'a2', check_date: '2026-08-09' },
      ])

    const rows = await listChecklist({ getAll } as never, 'org-1', '2026-08-12')

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'a1',
        checkedToday: true,
        missedDays: 0,
      }),
      expect.objectContaining({
        id: 'a2',
        checkedToday: false,
        missedDays: 2,
      }),
    ])
    expect(countChecklistOverdue(rows)).toBe(1)
  })
})
