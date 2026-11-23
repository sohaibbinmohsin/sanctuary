export const AGE_YEAR_MIN = 0
export const AGE_YEAR_MAX = 20
export const AGE_MONTH_MIN = 0
export const AGE_MONTH_MAX = 11

export function assertAnimalAge(years: number, months: number): void {
  if (!Number.isInteger(years) || years < AGE_YEAR_MIN || years > AGE_YEAR_MAX) {
    throw new Error('Years must be a whole number from 0 to 20.')
  }
  if (!Number.isInteger(months) || months < AGE_MONTH_MIN || months > AGE_MONTH_MAX) {
    throw new Error('Months must be a whole number from 0 to 11.')
  }
}

function unit(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatAgePhrase(
  years: number | null | undefined,
  months: number | null | undefined,
): string | null {
  if (years == null && months == null) return null
  const y = years ?? 0
  const m = months ?? 0
  try {
    assertAnimalAge(y, m)
  } catch {
    return null
  }
  if (y === 0 && m === 0) return '0 months'
  const parts: string[] = []
  if (y > 0) parts.push(unit(y, 'year', 'years'))
  if (m > 0) parts.push(unit(m, 'month', 'months'))
  return parts.join(' ')
}