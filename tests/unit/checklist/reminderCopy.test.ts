import { describe, expect, it } from 'vitest'
import {
  eveningReminderBody,
  eveningReminderTitle,
  morningReminderBody,
  morningReminderTitle,
} from '@/shared/lib/checklist/reminderCopy'

describe('eveningReminderBody', () => {
  it('singular when one unchecked', () => {
    expect(eveningReminderBody(1)).toBe(
      '1 animal on today’s checklist is still unchecked.',
    )
  })

  it('plural when multiple unchecked', () => {
    expect(eveningReminderBody(3)).toBe(
      '3 animals on today’s checklist are still unchecked.',
    )
  })
})

describe('morningReminderBody', () => {
  it('singular when one missed', () => {
    expect(morningReminderBody(1)).toBe(
      '1 animal still has a missed checklist day.',
    )
  })

  it('plural when multiple missed', () => {
    expect(morningReminderBody(4)).toBe(
      '4 animals still have missed checklist days.',
    )
  })
})

describe('reminder titles', () => {
  it('returns stable titles', () => {
    expect(eveningReminderTitle()).toBe('Checklist incomplete')
    expect(morningReminderTitle()).toBe('Checklist overdue')
  })
})
