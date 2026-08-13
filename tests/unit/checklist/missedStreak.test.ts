import { describe, expect, it } from 'vitest'
import {
  localDateString,
  missedDayStreak,
} from '@/shared/lib/checklist/missedStreak'

describe('localDateString', () => {
  it('formats device-local date parts', () => {
    const date = new Date(2026, 7, 12, 23, 59)
    expect(localDateString(date)).toBe('2026-08-12')
  })
})

describe('missedDayStreak', () => {
  it('is 0 when checked yesterday', () => {
    expect(
      missedDayStreak({
        addedAtIso: '2026-08-01T10:00:00.000Z',
        checkDates: ['2026-08-11'],
        today: '2026-08-12',
      }),
    ).toBe(0)
  })

  it('counts consecutive misses ending yesterday', () => {
    expect(
      missedDayStreak({
        addedAtIso: '2026-08-01T10:00:00.000Z',
        checkDates: ['2026-08-09'],
        today: '2026-08-12',
      }),
    ).toBe(2)
  })

  it('does not count days before the local added date', () => {
    const addedToday = new Date(2026, 7, 12, 9).toISOString()
    const addedYesterday = new Date(2026, 7, 11, 9).toISOString()

    expect(
      missedDayStreak({
        addedAtIso: addedToday,
        checkDates: [],
        today: '2026-08-12',
      }),
    ).toBe(0)
    expect(
      missedDayStreak({
        addedAtIso: addedYesterday,
        checkDates: [],
        today: '2026-08-12',
      }),
    ).toBe(1)
  })

  it('handles month boundaries as calendar days', () => {
    expect(
      missedDayStreak({
        addedAtIso: new Date(2026, 6, 30, 9).toISOString(),
        checkDates: ['2026-07-30'],
        today: '2026-08-02',
      }),
    ).toBe(2)
  })
})
