/** Paths and first URL segments that must never be public slugs. */
export const RESERVED_PUBLIC_SLUGS = new Set([
  '',
  'login',
  'animals',
  'ledger',
  'dashboard',
  'settings',
  'playground',
  'api',
  'assets',
  'favicon.ico',
  'manifest.webmanifest',
  'sw.js',
  'index.html',
])

export function normalizePublicSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function isReservedPublicSlug(slug: string): boolean {
  return RESERVED_PUBLIC_SLUGS.has(slug.toLowerCase())
}

/** 3–48 chars, starts/ends alphanumeric, kebab-case. */
export function isValidPublicSlugFormat(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(slug) && slug.length >= 3
}

export function defaultPublicSlug(orgName: string, initials: string): string {
  const fromInitials = normalizePublicSlug(initials)
  if (
    fromInitials.length >= 3 &&
    isValidPublicSlugFormat(fromInitials) &&
    !isReservedPublicSlug(fromInitials)
  ) {
    return fromInitials
  }
  const fromName = normalizePublicSlug(orgName)
  if (isValidPublicSlugFormat(fromName) && !isReservedPublicSlug(fromName)) {
    return fromName
  }
  // Fallback: pad short initials
  const padded = (fromInitials || 'org').padEnd(3, '0').slice(0, 48)
  return isReservedPublicSlug(padded) ? `${padded}-shelter` : padded
}

export function publicShelterPath(slug: string): string {
  return `/${slug}`
}

export function canUsePublicSlug(slug: string): boolean {
  return isValidPublicSlugFormat(slug) && !isReservedPublicSlug(slug)
}
