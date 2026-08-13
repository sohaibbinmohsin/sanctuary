import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyCountsAsInCareChange,
  countAnimalsWithStatusAndOthers,
  setStatusOutOfCareWithStrip,
} from '@/features/settings/domain/statusInCare'
import * as assignments from '@/features/statuses/domain/assignments'
import * as statuses from '@/features/statuses/domain/statuses'

describe('countAnimalsWithStatusAndOthers', () => {
  it('counts animals that have the status plus at least one other', async () => {
    const getOptional = vi.fn().mockResolvedValue({ n: 3 })
    const db = { getOptional } as never

    await expect(
      countAnimalsWithStatusAndOthers(db, 'status-1'),
    ).resolves.toBe(3)

    const [sql, params] = getOptional.mock.calls[0]!
    expect(sql).toMatch(/animal_status_assignments/i)
    expect(sql).toMatch(/EXISTS/i)
    expect(sql).toMatch(/status_id\s*!=/i)
    expect(params).toEqual(['status-1'])
  })

  it('returns 0 when no row', async () => {
    const getOptional = vi.fn().mockResolvedValue(null)
    await expect(
      countAnimalsWithStatusAndOthers({ getOptional } as never, 's'),
    ).resolves.toBe(0)
  })
})

describe('setStatusOutOfCareWithStrip', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('strips other statuses then sets out of care', async () => {
    const replaceSpy = vi
      .spyOn(assignments, 'replaceAnimalStatuses')
      .mockResolvedValue(undefined)
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)

    const getOptional = vi.fn().mockResolvedValue({ org_id: 'org-1' })
    const getAll = vi
      .fn()
      .mockResolvedValue([{ animal_id: 'a1' }, { animal_id: 'a2' }])
    const db = { getOptional, getAll } as never

    await setStatusOutOfCareWithStrip(db, {
      statusId: 'exit-status',
      stripOthers: true,
    })

    expect(replaceSpy).toHaveBeenCalledTimes(2)
    expect(replaceSpy).toHaveBeenNthCalledWith(1, db, {
      orgId: 'org-1',
      animalId: 'a1',
      statusIds: ['exit-status'],
    })
    expect(replaceSpy).toHaveBeenNthCalledWith(2, db, {
      orgId: 'org-1',
      animalId: 'a2',
      statusIds: ['exit-status'],
    })
    expect(setInCareSpy).toHaveBeenCalledWith(db, 'exit-status', false)
    expect(setInCareSpy.mock.invocationCallOrder[0]!).toBeGreaterThan(
      replaceSpy.mock.invocationCallOrder[1]!,
    )
  })

  it('skips strip and only flips the flag when stripOthers is false', async () => {
    const replaceSpy = vi
      .spyOn(assignments, 'replaceAnimalStatuses')
      .mockResolvedValue(undefined)
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)

    const db = { getOptional: vi.fn(), getAll: vi.fn() } as never
    await setStatusOutOfCareWithStrip(db, {
      statusId: 'status-1',
      stripOthers: false,
    })

    expect(replaceSpy).not.toHaveBeenCalled()
    expect(setInCareSpy).toHaveBeenCalledWith(db, 'status-1', false)
  })
})

describe('applyCountsAsInCareChange', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('turns in-care on without strip checks', async () => {
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)
    const getOptional = vi.fn()

    await expect(
      applyCountsAsInCareChange({ getOptional } as never, {
        statusId: 's1',
        countsAsInCare: true,
      }),
    ).resolves.toBe('ok')

    expect(setInCareSpy).toHaveBeenCalledWith(expect.anything(), 's1', true)
    expect(getOptional).not.toHaveBeenCalled()
  })

  it('returns needs_strip_confirm when animals have extras', async () => {
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)
    const getOptional = vi.fn().mockResolvedValue({ n: 2 })

    await expect(
      applyCountsAsInCareChange({ getOptional } as never, {
        statusId: 's1',
        countsAsInCare: false,
      }),
    ).resolves.toBe('needs_strip_confirm')

    expect(setInCareSpy).not.toHaveBeenCalled()
  })

  it('sets out of care immediately when no animals have extras', async () => {
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)
    const getOptional = vi.fn().mockResolvedValue({ n: 0 })

    await expect(
      applyCountsAsInCareChange({ getOptional } as never, {
        statusId: 's1',
        countsAsInCare: false,
      }),
    ).resolves.toBe('ok')

    expect(setInCareSpy).toHaveBeenCalledWith(expect.anything(), 's1', false)
  })
})
