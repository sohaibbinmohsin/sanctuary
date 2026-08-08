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
  'Money record updated.',
  'Entry saved. Clearer numbers for you and your donors.',
  'Books balanced a little more.',
]

export const DASHBOARD_GREETINGS = [
  'Another day of quiet courage at the sanctuary.',
  'The animals are lucky to have you.',
  'Steady work. Real impact.',
  'Here’s today’s snapshot. You’ve earned the pause.',
]

export function pickMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]!
}
