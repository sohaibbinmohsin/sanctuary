export const VACCINE_OPTIONS = [
  { id: 'rabies', label: 'Rabies' },
  { id: 'calci_fpv', label: 'Calci/FPV' },
] as const

export type VaccineId = (typeof VACCINE_OPTIONS)[number]['id']

export function isVaccineId(value: string | null | undefined): value is VaccineId {
  return VACCINE_OPTIONS.some((option) => option.id === value)
}

export function vaccineLabel(id: string | null | undefined): string | null {
  return VACCINE_OPTIONS.find((option) => option.id === id)?.label ?? null
}

export function vaccinationCareTitle(vaccine: string | null | undefined): string {
  const label = vaccineLabel(vaccine)
  return label ? `Vaccination · ${label}` : 'Vaccination'
}