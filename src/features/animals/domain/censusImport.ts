import { assertAnimalAge } from './age.ts'
import type { Sterilized } from './sterilized.ts'
import type { VaccineId } from '../../treatments/domain/vaccines.ts'
import { nextShelterId } from '../../../shared/lib/ids/shelterId.ts'

export const AWS_LUMS_ORG_NAME = 'Animal Welfare Society LUMS'

export const CENSUS_HEADERS = [
  'Name',
  'Picture',
  'Marking',
  'Age',
  'Sex',
  'Rabies Vaccination',
  'Calci/FPV Vaccination',
  'Neutered/Spayed',
] as const

export type CensusSkipReason =
  | 'blank_name'
  | 'unparsed_age'
  | 'unparsed_sex'
  | 'unparsed_sterilized'
  | 'unparsed_vaccine'

export class CensusCellError extends Error {
  readonly reason: CensusSkipReason

  constructor(reason: CensusSkipReason, message: string) {
    super(message)
    this.reason = reason
  }
}

export type CensusSourceRow = {
  rowNumber: number
  name: string
  picture: string
  marking: string
  age: string
  sex: string
  rabies: string
  calciFpv: string
  neuteredSpayed: string
}

export type CensusAnimalPlan = {
  rowNumber: number
  name: string
  species: 'Cat'
  sex: 'Male' | 'Female' | null
  markings: string | null
  ageYears: number | null
  ageMonths: number | null
  sterilized: Sterilized
  vaccines: VaccineId[]
}

export type CensusManualSplit = { rowNumber: number; name: string; reason: 'manual_split' }
export type CensusSkipped = { rowNumber: number; name: string; reason: CensusSkipReason }
export type CensusImportPlan = {
  animals: CensusAnimalPlan[]
  manualSplits: CensusManualSplit[]
  skipped: CensusSkipped[]
}

export type CensusAnimalWrite = CensusAnimalPlan & {
  shelterCode: string
  lifeStage: 'adult'
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
      continue
    }
    cell += ch
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export function parseCensusCsv(text: string): CensusSourceRow[] {
  const table = parseCsv(text)
  if (table.length === 0) throw new Error('Census CSV is empty.')
  const header = table[0]!.map((value) => value.trim())
  const expected = CENSUS_HEADERS.join(', ')
  const prefixMatches =
    header.length >= CENSUS_HEADERS.length &&
    CENSUS_HEADERS.every((value, index) => header[index] === value)
  if (!prefixMatches) {
    throw new Error(`Census CSV header must be ${expected}. Received ${header.join(', ')}.`)
  }
  return table.slice(1).map((cols, index) => ({
    rowNumber: index + 2,
    name: cols[0] ?? '',
    picture: cols[1] ?? '',
    marking: cols[2] ?? '',
    age: cols[3] ?? '',
    sex: cols[4] ?? '',
    rabies: cols[5] ?? '',
    calciFpv: cols[6] ?? '',
    neuteredSpayed: cols[7] ?? '',
  }))
}

export function isManualSplitName(name: string): boolean {
  return /\+|\/|&|\band\b/i.test(name)
}

export function parseCensusAge(raw: string): { years: number; months: number } | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return null
  const under = text.match(/^<\s*(\d+)\s*months?$/)
  const both = text.match(/^(\d+)\s*years?\s+(\d+)\s*months?$/)
  const yearsOnly = text.match(/^(\d+)\s*years?$/)
  const monthsOnly = text.match(/^(\d+)\s*months?$/)
  let years: number
  let months: number
  if (under) {
    years = 0
    months = Number(under[1])
  } else if (both) {
    years = Number(both[1])
    months = Number(both[2])
  } else if (yearsOnly) {
    years = Number(yearsOnly[1])
    months = 0
  } else if (monthsOnly) {
    years = 0
    months = Number(monthsOnly[1])
  } else {
    throw new CensusCellError('unparsed_age', `Unparsed age: ${raw}`)
  }
  try {
    assertAnimalAge(years, months)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unparsed age'
    throw new CensusCellError('unparsed_age', message)
  }
  return { years, months }
}

export function parseCensusSex(raw: string): 'Male' | 'Female' | null {
  const text = raw.trim().toLowerCase()
  if (text === '' || text === 'unknown' || text === 'unk' || text === '?') return null
  if (text === 'male' || text === 'm') return 'Male'
  if (text === 'female' || text === 'f') return 'Female'
  throw new CensusCellError('unparsed_sex', `Unparsed sex: ${raw}`)
}

export function parseCensusSterilized(raw: string): Sterilized {
  const text = raw.trim().toLowerCase()
  if (text === '' || text === 'unknown' || text === 'unk' || text === '?') return 'unknown'
  if (text === 'yes' || text === 'y' || text === 'neutered' || text === 'spayed') return 'yes'
  if (text === 'no' || text === 'n' || text === 'intact') return 'no'
  throw new CensusCellError('unparsed_sterilized', `Unparsed sterilized: ${raw}`)
}

export function parseCensusYes(raw: string): boolean {
  const text = raw.trim().toLowerCase()
  if (text === '' || text === 'no' || text === 'n' || text === 'unknown' || text === 'unk') return false
  if (text === 'yes' || text === 'y') return true
  throw new CensusCellError('unparsed_vaccine', `Unparsed vaccine cell: ${raw}`)
}

export function planCensusImport(rows: CensusSourceRow[]): CensusImportPlan {
  const animals: CensusAnimalPlan[] = []
  const manualSplits: CensusManualSplit[] = []
  const skipped: CensusSkipped[] = []

  for (const row of rows) {
    const name = row.name.trim()
    if (!name) {
      skipped.push({ rowNumber: row.rowNumber, name: '', reason: 'blank_name' })
      continue
    }
    if (isManualSplitName(name)) {
      manualSplits.push({ rowNumber: row.rowNumber, name, reason: 'manual_split' })
      continue
    }
    try {
      const age = parseCensusAge(row.age)
      const sex = parseCensusSex(row.sex)
      const sterilized = parseCensusSterilized(row.neuteredSpayed)
      const rabies = parseCensusYes(row.rabies)
      const calci = parseCensusYes(row.calciFpv)
      const vaccines: VaccineId[] = []
      if (rabies) vaccines.push('rabies')
      if (calci) vaccines.push('calci_fpv')
      const markings = row.marking.trim()
      animals.push({
        rowNumber: row.rowNumber,
        name,
        species: 'Cat',
        sex,
        markings: markings || null,
        ageYears: age ? age.years : null,
        ageMonths: age ? age.months : null,
        sterilized,
        vaccines,
      })
    } catch (err) {
      const reason = err instanceof CensusCellError ? err.reason : 'unparsed_age'
      skipped.push({ rowNumber: row.rowNumber, name, reason })
    }
  }

  return { animals, manualSplits, skipped }
}

export function assignCensusShelterCodes(
  prefix: string,
  existingCodes: string[],
  animals: CensusAnimalPlan[],
): CensusAnimalWrite[] {
  const codes = [...existingCodes]
  return animals.map((animal) => {
    const shelterCode = nextShelterId(prefix, codes)
    codes.push(shelterCode)
    return { ...animal, shelterCode, lifeStage: 'adult' }
  })
}

function flagged(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1
}

export function pickCensusStatusId(
  statuses: readonly {
    id: string
    label?: string | null
    counts_as_in_care?: boolean | number | null
    archived?: boolean | number | null
  }[],
): string | null {
  const active = statuses.filter((status) => !flagged(status.archived))
  const pool = active.length > 0 ? active : [...statuses]
  const intake = pool.find((status) => (status.label ?? '').trim().toLowerCase() === 'intake')
  if (intake) return intake.id
  const inCare = pool.find((status) => flagged(status.counts_as_in_care))
  if (inCare) return inCare.id
  return pool[0]?.id ?? null
}

export function censusIntakeDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function censusTreatedAt(intakeDate: string): string {
  return `${intakeDate}T12:00:00.000Z`
}