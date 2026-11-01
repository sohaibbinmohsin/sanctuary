export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return phone
  const start = digits.slice(0, 4)
  const end = digits.slice(-3)
  return `${start} ···· ${end}`
}

export function maskCnic(cnic?: string | null): string {
  if (!cnic) return ''
  const digits = cnic.replace(/\D/g, '')
  if (digits.length !== 13) return cnic
  const prefix = digits.slice(0, 5)
  const suffix = digits.slice(-1)
  return `${prefix}-·······-${suffix}`
}
