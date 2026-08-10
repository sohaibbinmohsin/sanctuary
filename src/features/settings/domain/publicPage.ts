import type { SanctuaryDb } from '@/shared/lib/db'
import {
  canUsePublicSlug,
  defaultPublicSlug,
  normalizePublicSlug,
} from '@/shared/lib/public/slug'

export type EnablePublicPageInput = {
  orgId: string
  orgName: string
  initials: string
}

/** Turns on the public shelter page, picking a slug if none is set yet. */
export async function enablePublicPage(
  db: SanctuaryDb,
  input: EnablePublicPageInput,
): Promise<{ slug: string }> {
  const existing = await db.getOptional<{ public_slug: string | null }>(
    `SELECT public_slug FROM organizations WHERE id = ?`,
    [input.orgId],
  )
  const slug =
    existing?.public_slug && canUsePublicSlug(existing.public_slug)
      ? existing.public_slug
      : defaultPublicSlug(input.orgName, input.initials)

  await db.execute(
    `UPDATE organizations SET public_enabled = 1, public_slug = ? WHERE id = ?`,
    [slug, input.orgId],
  )
  return { slug }
}

/** Turns off the public page. Keeps the slug so re-enabling reuses the same link. */
export async function disablePublicPage(
  db: SanctuaryDb,
  orgId: string,
): Promise<void> {
  await db.execute(
    `UPDATE organizations SET public_enabled = 0 WHERE id = ?`,
    [orgId],
  )
}

/**
 * Validates and saves a new public slug. Uniqueness across shelters is
 * enforced by a unique index in Postgres — a conflicting slug will surface
 * as a sync error rather than being caught here.
 */
export async function updatePublicSlug(
  db: SanctuaryDb,
  orgId: string,
  slug: string,
): Promise<void> {
  const normalized = normalizePublicSlug(slug)
  if (!canUsePublicSlug(normalized)) {
    throw new Error(
      'Choose a link of 3–48 letters, numbers, or dashes (not a reserved word).',
    )
  }
  await db.execute(`UPDATE organizations SET public_slug = ? WHERE id = ?`, [
    normalized,
    orgId,
  ])
}
