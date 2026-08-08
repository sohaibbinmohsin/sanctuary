export function formatShelterId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`
}

export function nextShelterId(prefix: string, existingCodes: string[]): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i')
  let max = 0
  for (const code of existingCodes) {
    const m = code.match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return formatShelterId(prefix, max + 1)
}
