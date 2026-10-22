/**
 * Formats a string in sentence case: first letter uppercase, rest lowercase.
 * Handles spaces, underscores, and hyphens gracefully.
 * e.g. "MEDICAL EMERGENCY" -> "Medical emergency"
 *      "in_treatment" -> "In treatment"
 *      "dog" -> "Dog"
 */
export function toSentenceCase(input: string | null | undefined): string {
  if (!input) return ''
  const trimmed = input.trim()
  if (!trimmed) return ''
  const normalized = trimmed.replace(/[-_]+/g, ' ').toLowerCase()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
