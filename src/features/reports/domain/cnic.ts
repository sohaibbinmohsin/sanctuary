/**
 * Formats a CNIC number during user typing or display.
 * Standard Pakistan format: XXXXX-XXXXXXX-X (5-7-1 = 13 digits).
 */
export function formatCnic(value?: string | null): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 13)
  if (!digits) return ''
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`
}

/**
 * Validates a CNIC number.
 * Empty is valid because reporter CNIC is optional.
 * If provided, must be exactly 13 digits.
 */
export function validateCnic(value?: string | null): { isValid: boolean; error?: string } {
  if (!value || !value.trim()) return { isValid: true }
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 13) {
    return {
      isValid: false,
      error: 'CNIC must be 13 digits (e.g. 42101-1234567-1)',
    }
  }
  return { isValid: true }
}
