/**
 * Formats a phone number for display or during user typing.
 * Supports Pakistan mobile (03XX-XXXXXXX), landline (021-XXXXXXXX), and international (+92 ...).
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  const isPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')

  if (!digits) return isPlus ? '+' : ''

  if (isPlus) {
    if (digits.startsWith('92') && digits.length >= 3) {
      const rest = digits.slice(2)
      if (rest.length <= 3) {
        return `+92 ${rest}`
      }
      return `+92 ${rest.slice(0, 3)} ${rest.slice(3, 10)}`.trim()
    }
    // Generic international format
    if (digits.length <= 3) return `+${digits}`
    if (digits.length <= 6) return `+${digits.slice(0, 3)} ${digits.slice(3)}`
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 12)}`.trim()
  }

  // If exactly 10 digits starting with '3', it is a Pakistan mobile missing the leading 0 (common from spreadsheets)
  if (digits.length === 10 && digits.startsWith('3')) {
    digits = `0${digits}`
  }

  // Pakistan local mobile numbers starting with 03 (11 digits: 03XX XXXXXXX)
  if (digits.startsWith('03')) {
    if (digits.length <= 4) {
      return digits
    }
    return `${digits.slice(0, 4)} ${digits.slice(4, 11)}`
  }

  // Pakistan landlines starting with 0 (e.g. 021, 042, 051, 041, 061, 091, 081, 052, 055, or smaller city area codes)
  if (digits.startsWith('0')) {
    // 3-digit metro area codes (021 Karachi, 042 Lahore, 051 Islamabad/Rwp, 041 Faisalabad, 061 Multan, 091 Peshawar, 081 Quetta, 052 Sialkot, 055 Gujranwala)
    if (/^0(21|42|51|41|61|91|81|52|55)/.test(digits)) {
      if (digits.length <= 3) return digits
      return `${digits.slice(0, 3)} ${digits.slice(3, 11)}`
    }
    // 4-digit area codes for smaller cities (e.g. 0492, 0563)
    if (digits.length <= 4) return digits
    return `${digits.slice(0, 4)} ${digits.slice(4, 11)}`
  }

  // Other standard 10-11 digit numbers
  if (digits.length > 4 && digits.length <= 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`
  }

  return trimmed
}

/**
 * Validates whether a phone number is valid.
 * Empty is valid because reporter phone is optional.
 */
export function validatePhoneNumber(value: string): { isValid: boolean; error?: string } {
  const trimmed = value.trim()
  if (!trimmed) return { isValid: true }

  // Check invalid characters
  if (!/^[+\d\s\-()]+$/.test(trimmed)) {
    return { isValid: false, error: 'Phone contains invalid characters.' }
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 10) {
    return { isValid: false, error: 'Phone number is too short (min 10 digits).' }
  }
  if (digits.length > 15) {
    return { isValid: false, error: 'Phone number is too long (max 15 digits).' }
  }

  return { isValid: true }
}
