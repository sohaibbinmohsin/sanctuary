function escapeCsvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ]
  return lines.join('\n')
}

export type AnimalCsvRow = {
  shelter_code: string
  name?: string | null
  species: string
  markings?: string | null
  status?: string | null
  sex?: string | null
  intake_date?: string | null
  notes?: string | null
}

export function animalsToCsv(rows: AnimalCsvRow[]): string {
  return toCsv(
    [
      'shelter_code',
      'name',
      'species',
      'sex',
      'markings',
      'status',
      'intake_date',
      'notes',
    ],
    rows.map((r) => [
      r.shelter_code,
      r.name,
      r.species,
      r.sex,
      r.markings,
      r.status,
      r.intake_date,
      r.notes,
    ]),
  )
}

export type TreatmentCsvRow = {
  shelter_code?: string | null
  treated_at: string
  treatment_type: string
  notes?: string | null
}

export function treatmentsToCsv(rows: TreatmentCsvRow[]): string {
  return toCsv(
    ['shelter_code', 'treated_at', 'treatment_type', 'notes'],
    rows.map((r) => [r.shelter_code, r.treated_at, r.treatment_type, r.notes]),
  )
}

export type LedgerCsvRow = {
  entry_date: string
  direction: string
  category?: string | null
  amount_cents: number
  notes?: string | null
  shelter_code?: string | null
}

export function ledgerToCsv(rows: LedgerCsvRow[]): string {
  return toCsv(
    [
      'entry_date',
      'direction',
      'category',
      'amount_cents',
      'notes',
      'shelter_code',
    ],
    rows.map((r) => [
      r.entry_date,
      r.direction,
      r.category,
      r.amount_cents,
      r.notes,
      r.shelter_code,
    ]),
  )
}
