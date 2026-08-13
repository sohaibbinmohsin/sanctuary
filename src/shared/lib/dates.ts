import { localDateString } from '@/shared/lib/checklist/missedStreak'

/**
 * Build an arrival care-note timestamp from a date-only intake field.
 * Today → current clock time; other days → local noon (not UTC noon).
 */
export function arrivalTimestampFromIntakeDate(
  intakeDate: string,
  now = new Date(),
): string {
  if (intakeDate === localDateString(now)) {
    return now.toISOString()
  }
  const localNoon = new Date(`${intakeDate}T12:00:00`)
  if (Number.isNaN(localNoon.getTime())) return now.toISOString()
  return localNoon.toISOString()
}

/** True when the timestamp is the old UTC-noon placeholder used for date-only arrivals. */
export function isUtcNoonPlaceholder(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T12:00:00(\.000)?Z$/.test(iso.trim())
}

/** Format care-log timestamps; UTC-noon placeholders show as local noon, not 17:00. */
export function formatCareTimestamp(iso: string): string {
  const raw = iso.trim()
  if (!raw) return iso
  if (isUtcNoonPlaceholder(raw)) {
    const day = raw.slice(0, 10)
    return new Date(`${day}T12:00:00`).toLocaleString()
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}
