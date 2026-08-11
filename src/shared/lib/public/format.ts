/** Friendly labels for care entries on the public shelter page. */
export const PUBLIC_CARE_LABELS: Record<string, string> = {
  meds: 'Medicine',
  vet: 'Vet visit',
  procedure: 'Procedure',
  other: 'Other care',
  intake: 'Arrived',
  arrived: 'Arrived',
  status: 'Status',
}

export function publicCareLabel(treatmentType: string): string {
  return PUBLIC_CARE_LABELS[treatmentType] ?? treatmentType
}

export function isArrivalCareType(type: string | null | undefined): boolean {
  return type === 'arrived' || type === 'intake'
}

/**
 * Formats public dates. Accepts date-only (`YYYY-MM-DD`) or full ISO timestamps.
 */
export function formatPublicWhen(iso: string): string {
  const raw = iso.trim()
  if (!raw) return iso

  const hasClock = /T\d{2}:\d{2}/.test(raw)
  const d = new Date(hasClock ? raw : `${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso

  if (hasClock) {
    return d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function compareCareNewestFirst(
  a: { treatedAt: string },
  b: { treatedAt: string },
): number {
  return b.treatedAt.localeCompare(a.treatedAt)
}
