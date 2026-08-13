export const INTAKE_MESSAGES = [
  'Welcome home. Another life safe in your care.',
  'Saved. One more animal with a place on the board.',
  'Animal added. You’ve got this.',
  'Recorded. Sanctuary grows one save at a time.',
]

export const TREATMENT_MESSAGES = [
  'Care note saved. The next person on shift will thank you.',
  'Care history updated.',
  'Logged. Continuity of care starts here.',
]

export const LEDGER_MESSAGES = [
  'Ledger record updated.',
  'Entry saved. Clearer numbers for you and your donors.',
  'Books balanced a little more.',
]

export const DASHBOARD_GREETINGS = [
  'Another day of quiet courage at the sanctuary.',
  'The animals are lucky to have you.',
  'Steady work. Real impact.',
  'Here’s today’s snapshot. You’ve earned the pause.',
]

export const CHECKLIST_MESSAGES = [
  'Checked. Wonderful humans make sanctuaries work.',
  'Care marked. The animals are lucky you’re here.',
  'Done. Quiet kindness, real impact.',
  'Tick saved. You’re one of the good ones.',
  'Logged. Another life felt your care today.',
  'Nice work. Showing up for them matters.',
]

export function checklistTickMessage(animalLabel?: string): string {
  const name = animalLabel?.trim()
  if (name) {
    return pickMessage([
      `${name} is sorted. You’re wonderful for showing up.`,
      `${name} checked. Soft hearts run this place.`,
      `Care noted for ${name}. Thank you for being here.`,
      `${name} felt that. Keep going, good human.`,
      ...CHECKLIST_MESSAGES,
    ])
  }
  return pickMessage(CHECKLIST_MESSAGES)
}

/** True when checking this row finishes today’s full checklist. */
export function willCompleteChecklist(
  rows: { id: string; checkedToday: boolean }[],
  row: { id: string; checkedToday: boolean },
  checked: boolean,
): boolean {
  if (!checked || row.checkedToday || rows.length === 0) return false
  return rows.every((item) => item.id === row.id || item.checkedToday)
}

export function pickMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]!
}
