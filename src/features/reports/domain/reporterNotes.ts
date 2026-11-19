/**
 * Formats the reporter line stored on animal / intake notes at creation.
 * Keep the backfill script parser in sync with parseReporterFromNotes.
 */
export function formatReporterNotesLine(
  reporterName: string | null | undefined,
  reporterPhone?: string | null,
): string | null {
  const name = reporterName?.trim()
  if (!name) return null
  const phone = reporterPhone?.trim()
  return phone ? `Reporter: ${name} (${phone})` : `Reporter: ${name}`
}

/**
 * Parses the "Reporter: {name} ({phone})" line written into animal / intake notes
 * by createAnimalFromRescueReport. Used by recovery tooling.
 */
export function parseReporterFromNotes(
  notes: string | null | undefined,
): { name: string; phone: string | null } | null {
  if (!notes || typeof notes !== 'string') return null
  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!/^Reporter:/i.test(line)) continue
    const withPhone = line.match(/^Reporter:\s*(.+?)\s*\(([^)]+)\)\s*$/i)
    if (withPhone) {
      const name = withPhone[1].trim()
      const phone = withPhone[2].trim()
      if (name) return { name, phone: phone || null }
    }
    const nameOnly = line.match(/^Reporter:\s*(.+?)\s*$/i)
    if (nameOnly) {
      const name = nameOnly[1].trim()
      if (name) return { name, phone: null }
    }
  }
  return null
}
