export type Sterilized = 'yes' | 'no' | 'unknown'

export const STERILIZED_OPTIONS: readonly { value: Sterilized; label: 'Yes' | 'No' | 'Unknown' }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
]

export function sterilizedOrUnknown(value: string | null | undefined): Sterilized {
  if (value === 'yes' || value === 'no' || value === 'unknown') return value
  return 'unknown'
}

export function sterilizedLabel(value: string | null | undefined): 'Yes' | 'No' | 'Unknown' {
  if (value === 'yes') return 'Yes'
  if (value === 'no') return 'No'
  return 'Unknown'
}