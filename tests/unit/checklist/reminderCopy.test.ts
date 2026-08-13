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
      '1 animal wasn’t checked yesterday.',
    )
  })

  it('plural when multiple missed', () => {
    expect(morningReminderBody(4)).toBe(
      '4 animals weren’t checked yesterday.',
    )
  })
})

describe('reminder titles', () => {
  it('returns stable branded titles', () => {
    expect(eveningReminderTitle()).toBe('Sanctuary · Checklist incomplete')
    expect(morningReminderTitle()).toBe('Sanctuary · Checklist overdue')
  })
})
