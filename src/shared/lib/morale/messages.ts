export const INTAKE_MESSAGES = [
  'Welcome home — another life safe in your care.',
  'Logged. One more animal with a name on the board.',
  'Intake saved. You’ve got this.',
  'Recorded. Sanctuary grows one save at a time.',
]

export const TREATMENT_MESSAGES = [
  'Treatment noted — the next handoff will thank you.',
  'Care history updated.',
  'Logged. Continuity of care starts here.',
]

export const LEDGER_MESSAGES = [
  'Money trail updated.',
  'Entry saved — clarity for donors and for you.',
  'Books balanced a little more.',
]

export const DASHBOARD_GREETINGS = [
  'Another day of quiet courage at the sanctuary.',
  'The animals are lucky to have you.',
  'Steady work. Real impact.',
  'Here’s today’s snapshot — you’ve earned the pause.',
]

export function pickMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]!
}
