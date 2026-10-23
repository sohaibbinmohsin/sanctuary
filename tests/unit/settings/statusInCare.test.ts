import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyCountsAsInCareChange,
  countAnimalsWithStatusAndOthers,
  setStatusOutOfCareWithStrip,
} from '@/features/settings/domain/statusInCare'
import * as statuses from '@/features/statuses/domain/statuses'

describe('countAnimalsWithStatusAndOthers', () => {
  it('returns 0 because statuses are 1:1 on animals.status_id', async () => {
    const getOptional = vi.fn()
    const db = { getOptional } as never

    await expect(
      countAnimalsWithStatusAndOthers(db, 'status-1'),
    ).resolves.toBe(0)
    expect(getOptional).not.toHaveBeenCalled()
  })
})

describe('setStatusOutOfCareWithStrip', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sets status out of care directly', async () => {
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)

    const db = {} as never

    await setStatusOutOfCareWithStrip(db, {
      statusId: 'exit-status',
      stripOthers: true,
    })

    expect(setInCareSpy).toHaveBeenCalledWith(db, 'exit-status', false)
  })
})

describe('applyCountsAsInCareChange', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('turns in-care on directly', async () => {
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)
    const db = {} as never

    await expect(
      applyCountsAsInCareChange(db, {
        statusId: 's1',
        countsAsInCare: true,
      }),
    ).resolves.toBe('ok')

    expect(setInCareSpy).toHaveBeenCalledWith(db, 's1', true)
  })

  it('sets out of care immediately', async () => {
    const setInCareSpy = vi
      .spyOn(statuses, 'setStatusInCare')
      .mockResolvedValue(undefined)
    const db = {} as never

    await expect(
      applyCountsAsInCareChange(db, {
        statusId: 's1',
        countsAsInCare: false,
      }),
    ).resolves.toBe('ok')

    expect(setInCareSpy).toHaveBeenCalledWith(db, 's1', false)
  })
})
