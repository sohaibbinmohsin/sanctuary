import type { SanctuaryDb } from '@/shared/lib/db'

export function normalizeEntitySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const PRESET_VET_CLINICS = [
  'UVAS Small Animal Hospital',
  'Pet Care Hospital DHA',
  'Pets Oasis Hospital',
  'Richmond Veterinary Clinic',
  'Dr. Rana Pet Clinic',
  'Animal Doctors Lahore',
  'Pet Pulse Animal Clinic',
] as const

export const PRESET_PARTNER_ORGS = [
  "Todd's Welfare Society (TWS)",
  'JFK Animal Rescue and Shelter',
  'Save Our Strays (SOS)',
  'ACF Animal Rescue',
  'CDRS Benji Project',
  'Brooke Hospital for Animals',
  'Rescue 1122 Animal Emergency Unit',
] as const

export async function getClinicSuggestions(
  db: SanctuaryDb | null,
  orgId: string,
  query: string,
): Promise<{ name: string; slug: string }[]> {
  const q = query.trim().toLowerCase()
  const map = new Map<string, { name: string; slug: string }>()

  // Add presets
  for (const name of PRESET_VET_CLINICS) {
    const slug = normalizeEntitySlug(name)
    if (!q || name.toLowerCase().includes(q) || slug.includes(q)) {
      map.set(slug, { name, slug })
    }
  }

  // Scan recent treatments if db is ready
  if (db && typeof db.getAll === 'function') {
    try {
      const rows = await db.getAll<{ notes: string | null }>(
        `SELECT notes FROM treatments WHERE org_id = ? AND notes LIKE '%Clinic:%' LIMIT 50`,
        [orgId],
      )
      for (const row of rows) {
        if (!row.notes) continue
        const match = row.notes.match(/Clinic:\s*([^·\[\n]+)/)
        if (match && match[1]) {
          const rawName = match[1].trim()
          if (rawName) {
            const slug = normalizeEntitySlug(rawName)
            if (!q || rawName.toLowerCase().includes(q) || slug.includes(q)) {
              map.set(slug, { name: rawName, slug })
            }
          }
        }
      }
    } catch {
      // Non-fatal if treatments table query fails
    }
  }

  return Array.from(map.values()).slice(0, 8)
}

export async function getPartnerSuggestions(
  db: SanctuaryDb | null,
  orgId: string,
  query: string,
): Promise<{ name: string; slug: string }[]> {
  const q = query.trim().toLowerCase()
  const map = new Map<string, { name: string; slug: string }>()

  // Add presets
  for (const name of PRESET_PARTNER_ORGS) {
    const slug = normalizeEntitySlug(name)
    if (!q || name.toLowerCase().includes(q) || slug.includes(q)) {
      map.set(slug, { name, slug })
    }
  }

  // Scan recent treatments if db is ready
  if (db && typeof db.getAll === 'function') {
    try {
      const rows = await db.getAll<{ notes: string | null }>(
        `SELECT notes FROM treatments WHERE org_id = ? AND notes LIKE '%Transferred to:%' LIMIT 50`,
        [orgId],
      )
      for (const row of rows) {
        if (!row.notes) continue
        const match = row.notes.match(/Transferred to:\s*([^·\[\n]+)/)
        if (match && match[1]) {
          const rawName = match[1].trim()
          if (rawName) {
            const slug = normalizeEntitySlug(rawName)
            if (!q || rawName.toLowerCase().includes(q) || slug.includes(q)) {
              map.set(slug, { name: rawName, slug })
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return Array.from(map.values()).slice(0, 8)
}
