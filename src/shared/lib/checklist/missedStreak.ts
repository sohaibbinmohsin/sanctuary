const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

export function localDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateStringToDay(date: string): number {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new Error(`Invalid local date: ${date}`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const value = Date.UTC(year, month - 1, day)
  const parsed = new Date(value)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid local date: ${date}`)
  }
  return Math.floor(value / DAY_MS)
}

export function missedDayStreak(input: {
  addedAtIso: string
  checkDates: string[]
  today: string
}): number {
  const addedAt = new Date(input.addedAtIso)
  if (Number.isNaN(addedAt.getTime())) {
    throw new Error(`Invalid added_at timestamp: ${input.addedAtIso}`)
  }

  const addedDay = dateStringToDay(localDateString(addedAt))
  const yesterday = dateStringToDay(input.today) - 1
  const checkedDays = new Set(input.checkDates.map(dateStringToDay))

  let streak = 0
  for (let day = yesterday; day >= addedDay && !checkedDays.has(day); day -= 1) {
    streak += 1
  }
  return streak
}
