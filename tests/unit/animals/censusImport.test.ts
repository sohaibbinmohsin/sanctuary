import { describe, expect, it } from 'vitest'
import {
  assignCensusShelterCodes,
  censusIntakeDate,
  censusTreatedAt,
  isManualSplitName,
  parseCensusCsv,
  pickCensusStatusId,
  planCensusImport,
} from '@/features/animals/domain/censusImport'

const csv = [
  'Name,Picture,Marking,Age,Sex,Rabies Vaccination,Calci/FPV Vaccination,Neutered/Spayed',
  'Mona,https://cdn.example/mona.jpg,"white, paw",5 years,Female,Yes,No,Unknown',
  'monia + child,https://cdn.example/group.jpg,,<6 months,Female,Yes,Yes,Yes',
  'Kit,,black ear,8 months,Male,No,Yes,No',
  ',,,,,,,',
  'Nope,,,"about 2",Female,Yes,No,No',
  'Coco,, ,2 years 6 months,F,Yes,Yes,Spayed',
  'Coco,, , , , , , ',
].join('\n')

describe('census csv', () => {
  it('rejects a header that is not the Sheet1 contract', () => {
    expect(() => parseCensusCsv('Name,Age\nMona,5 years\n')).toThrow(/Census CSV header must be/)
  })

  it('parses quotes and keeps the picture cell only on the source row', () => {
    const rows = parseCensusCsv(csv)
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      name: 'Mona',
      picture: 'https://cdn.example/mona.jpg',
      marking: 'white, paw',
      age: '5 years',
    })
    expect(rows[1]!.rowNumber).toBe(3)
  })
})

describe('planCensusImport', () => {
  const plan = planCensusImport(parseCensusCsv(csv))

  it('maps age, sex, sterilized, and yes vaccines for one cat per row', () => {
    expect(plan.animals.map((animal) => animal.name)).toEqual(['Mona', 'Kit', 'Coco', 'Coco'])
    expect(plan.animals[0]).toMatchObject({
      rowNumber: 2,
      species: 'Cat',
      sex: 'Female',
      markings: 'white, paw',
      ageYears: 5,
      ageMonths: 0,
      sterilized: 'unknown',
      vaccines: ['rabies'],
    })
    expect(plan.animals[1]).toMatchObject({
      rowNumber: 4,
      sex: 'Male',
      markings: 'black ear',
      ageYears: 0,
      ageMonths: 8,
      sterilized: 'no',
      vaccines: ['calci_fpv'],
    })
    expect(plan.animals[2]).toMatchObject({
      ageYears: 2,
      ageMonths: 6,
      sex: 'Female',
      sterilized: 'yes',
      vaccines: ['rabies', 'calci_fpv'],
      markings: null,
    })
    expect(plan.animals[3]).toMatchObject({
      name: 'Coco',
      ageYears: null,
      ageMonths: null,
      sex: null,
      sterilized: 'unknown',
      vaccines: [],
    })
    expect(plan.animals.every((animal) => animal.species === 'Cat')).toBe(true)
    for (const animal of plan.animals) {
      expect(animal).not.toHaveProperty('under')
      expect(animal).not.toHaveProperty('picture')
    }
    expect(JSON.stringify(plan)).not.toContain('cdn.example')
  })

  it('calls out group rows and does not split them', () => {
    expect(isManualSplitName('monia + child')).toBe(true)
    expect(isManualSplitName('Tom and Jerry')).toBe(true)
    expect(isManualSplitName('Mona & kitten')).toBe(true)
    expect(isManualSplitName('Mona/Kit')).toBe(true)
    expect(isManualSplitName('Mona')).toBe(false)
    expect(plan.manualSplits).toEqual([
      { rowNumber: 3, name: 'monia + child', reason: 'manual_split' },
    ])
    expect(plan.animals.some((animal) => animal.name.toLowerCase().includes('child'))).toBe(false)
  })

  it('skips blank names and unparsed ages', () => {
    expect(plan.skipped).toEqual([
      { rowNumber: 5, name: '', reason: 'blank_name' },
      { rowNumber: 6, name: 'Nope', reason: 'unparsed_age' },
    ])
  })
})

describe('census writes', () => {
  it('assigns the next shelter codes and keeps every import adult', () => {
    const plan = planCensusImport(parseCensusCsv(csv))
    const writes = assignCensusShelterCodes('AWS', ['AWS-0002'], plan.animals)
    expect(writes.map((write) => write.shelterCode)).toEqual(['AWS-0003', 'AWS-0004', 'AWS-0005', 'AWS-0006'])
    expect(writes.every((write) => write.lifeStage === 'adult')).toBe(true)
    expect(writes[1]!.ageYears).toBe(0)
    expect(writes[1]!.ageMonths).toBe(8)
  })

  it('picks the Intake status for booleans and for 0/1 flags', () => {
    expect(
      pickCensusStatusId([
        { id: 'adopted', label: 'Adopted', counts_as_in_care: false, archived: false },
        { id: 'intake', label: 'Intake', counts_as_in_care: true, archived: false },
      ]),
    ).toBe('intake')
    expect(
      pickCensusStatusId([
        { id: 'old', label: 'Intake', counts_as_in_care: 1, archived: 1 },
        { id: 'care', label: 'In sanctuary', counts_as_in_care: 1, archived: 0 },
      ]),
    ).toBe('care')
  })

  it('uses the local calendar date and noon UTC for vaccination timestamps', () => {
    expect(censusIntakeDate(new Date(2026, 10, 20, 15, 30))).toBe('2026-11-20')
    expect(censusTreatedAt('2026-11-20')).toBe('2026-11-20T12:00:00.000Z')
  })
})