/** Pure Web Push copy for checklist evening / morning reminders. */

export function eveningReminderTitle(): string {
  return 'Checklist incomplete'
}

export function eveningReminderBody(uncheckedCount: number): string {
  return uncheckedCount === 1
    ? '1 animal on today’s checklist is still unchecked.'
    : `${uncheckedCount} animals on today’s checklist are still unchecked.`
}

export function morningReminderTitle(): string {
  return 'Checklist overdue'
}

export function morningReminderBody(missedCount: number): string {
  return missedCount === 1
    ? '1 animal still has a missed checklist day.'
    : `${missedCount} animals still have missed checklist days.`
}
