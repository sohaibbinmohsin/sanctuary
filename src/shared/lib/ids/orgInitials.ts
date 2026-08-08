export function orgInitials(orgName: string): string {
  return orgName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
