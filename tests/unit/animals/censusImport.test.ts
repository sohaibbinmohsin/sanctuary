import { describe, expect, it } from 'vitest'
import {
  assignCensusShelterCodes,
  censusIntakeDate,
  censusTreatedAt,
  parseCensusAge,
  parseCensusCsv,
  parseCensusSex,
  pickCensusStatusId,
  planCensusImport,
  splitCensusNames,
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

describe('parseCensusAge', () => {
  it('parses under-six-months ages without an under flag', () => {
    expect(parseCensusAge('<6 months')).toEqual({ years: 0, months: 6 })
    expect(parseCensusAge('<6 months')).not.toHaveProperty('under')
  })

  it('leaves a dash and any other unreadable age unset', () => {
    expect(parseCensusAge('-')).toBeNull()
    expect(parseCensusAge('—')).toBeNull()
    expect(parseCensusAge('about 2')).toBeNull()
    expect(parseCensusAge('21 years')).toBeNull()
  })
})

describe('parseCensusSex', () => {
  it('reads a dash as the same unknown value as a blank sex', () => {
    expect(parseCensusSex('-')).toBeNull()
    expect(parseCensusSex('—')).toBeNull()
    expect(parseCensusSex('-')).toBe(parseCensusSex(''))
    expect(parseCensusSex('-')).toBe(parseCensusSex('unknown'))
    expect(parseCensusSex('Female')).toBe('Female')
    expect(parseCensusSex('m')).toBe('Male')
  })
})

describe('census csv', () => {
  it('rejects a header that is not the Sheet1 contract', () => {
    expect(() => parseCensusCsv('Name,Age\nMona,5 years\n')).toThrow(/Census CSV header must be/)
    expect(() =>
      parseCensusCsv(
        'Picture,Name,Marking,Age,Sex,Rabies Vaccination,Calci/FPV Vaccination,Neutered/Spayed\n',
      ),
    ).toThrow(/Census CSV header must be/)
    expect(() =>
      parseCensusCsv(
        'Name,Picture,Marking,Age,Sex,Rabies Vaccination,Calci/FPV Vaccination,Concerning Medical Issues,Remarks\n',
      ),
    ).toThrow(/Census CSV header must be/)
  })

  it('ignores trailing Concerning Medical Issues and Remarks columns', () => {
    const extended = [
      'Name,Picture,Marking,Age,Sex,Rabies Vaccination,Calci/FPV Vaccination,Neutered/Spayed,Concerning Medical Issues,Remarks',
      'Mona,https://cdn.example/mona.jpg,"white, paw",5 years,Female,Yes,No,Unknown,limping,foster note',
    ].join('\n')
    const rows = parseCensusCsv(extended)
    expect(rows).toEqual([
      {
        rowNumber: 2,
        name: 'Mona',
        picture: 'https://cdn.example/mona.jpg',
        marking: 'white, paw',
        age: '5 years',
        sex: 'Female',
        rabies: 'Yes',
        calciFpv: 'No',
        neuteredSpayed: 'Unknown',
      },
    ])
    const serialized = JSON.stringify(rows)
    expect(serialized).not.toContain('limping')
    expect(serialized).not.toContain('foster note')
    expect(serialized).not.toContain('Concerning Medical Issues')
    expect(serialized).not.toContain('Remarks')
    const plan = planCensusImport(rows)
    expect(plan.animals).toHaveLength(1)
    expect(plan.animals[0]).toMatchObject({ name: 'Mona', vaccines: ['rabies'] })
    expect(JSON.stringify(plan)).not.toContain('limping')
    expect(JSON.stringify(plan)).not.toContain('foster note')
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

  it('maps age, sex, sterilized, and yes vaccines onto each imported cat', () => {
    expect(plan.animals.map((animal) => animal.name)).toEqual([
      'Mona',
      'monia',
      'child',
      'Kit',
      'Nope',
      'Coco',
      'Coco',
    ])
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
    expect(plan.animals[3]).toMatchObject({
      rowNumber: 4,
      sex: 'Male',
      markings: 'black ear',
      ageYears: 0,
      ageMonths: 8,
      sterilized: 'no',
      vaccines: ['calci_fpv'],
    })
    expect(plan.animals[4]).toMatchObject({
      rowNumber: 6,
      name: 'Nope',
      ageYears: null,
      ageMonths: null,
      sex: 'Female',
      sterilized: 'no',
      vaccines: ['rabies'],
    })
    expect(plan.animals[5]).toMatchObject({
      ageYears: 2,
      ageMonths: 6,
      sex: 'Female',
      sterilized: 'yes',
      vaccines: ['rabies', 'calci_fpv'],
      markings: null,
    })
    expect(plan.animals[6]).toMatchObject({
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
    expect(plan).not.toHaveProperty('manualSplits')
  })

  it('splits a name + child row into two animals that share the row', () => {
    expect(splitCensusNames('monia + child')).toEqual(['monia', 'child'])
    expect(splitCensusNames('Tom and Jerry')).toEqual(['Tom', 'Jerry'])
    expect(splitCensusNames('Tom AND Jerry')).toEqual(['Tom', 'Jerry'])
    expect(splitCensusNames('Mona & kitten')).toEqual(['Mona', 'kitten'])
    expect(splitCensusNames('Mona/Kit')).toEqual(['Mona', 'Kit'])
    expect(splitCensusNames('A + B and C')).toEqual(['A', 'B', 'C'])
    expect(splitCensusNames('Mona')).toEqual(['Mona'])
    expect(splitCensusNames('Sandy')).toEqual(['Sandy'])
    const split = plan.animals.filter((animal) => animal.rowNumber === 3)
    expect(split.map((animal) => animal.name)).toEqual(['monia', 'child'])
    for (const animal of split) {
      expect(animal).toMatchObject({
        rowNumber: 3,
        species: 'Cat',
        sex: 'Female',
        markings: null,
        ageYears: 0,
        ageMonths: 6,
        sterilized: 'yes',
        vaccines: ['rabies', 'calci_fpv'],
      })
    }
    const writes = assignCensusShelterCodes('AWS', ['AWS-0002'], split)
    expect(writes.map((write) => write.shelterCode)).toEqual(['AWS-0003', 'AWS-0004'])
    expect(writes[0]!.name).toBe('monia')
    expect(writes[1]!.name).toBe('child')
  })

  it('imports a dash age and a dash sex instead of skipping the cat', () => {
    const imported = planCensusImport([
      {
        rowNumber: 10,
        name: 'Dash',
        picture: '',
        marking: 'tabby',
        age: '-',
        sex: 'Female',
        rabies: 'No',
        calciFpv: 'Yes',
        neuteredSpayed: 'No',
      },
      {
        rowNumber: 11,
        name: 'Que',
        picture: '',
        marking: '',
        age: '2 years',
        sex: '-',
        rabies: 'Yes',
        calciFpv: 'No',
        neuteredSpayed: 'Unknown',
      },
    ])
    expect(imported.skipped).toEqual([])
    expect(imported.animals).toMatchObject([
      {
        rowNumber: 10,
        name: 'Dash',
        sex: 'Female',
        markings: 'tabby',
        ageYears: null,
        ageMonths: null,
        sterilized: 'no',
        vaccines: ['calci_fpv'],
      },
      {
        rowNumber: 11,
        name: 'Que',
        sex: null,
        markings: null,
        ageYears: 2,
        ageMonths: 0,
        sterilized: 'unknown',
        vaccines: ['rabies'],
      },
    ])
  })

  it('skips a blank name and still imports an age it cannot read', () => {
    expect(plan.skipped).toEqual([{ rowNumber: 5, name: '', reason: 'blank_name' }])
    expect(plan.animals.find((animal) => animal.name === 'Nope')).toMatchObject({
      ageYears: null,
      ageMonths: null,
    })
  })

  it('still skips a sterilized value it cannot read', () => {
    const imported = planCensusImport([
      {
        rowNumber: 12,
        name: 'Nope',
        picture: '',
        marking: '',
        age: '1 year',
        sex: 'Female',
        rabies: 'No',
        calciFpv: 'No',
        neuteredSpayed: 'maybe',
      },
    ])
    expect(imported.animals).toEqual([])
    expect(imported.skipped).toEqual([{ rowNumber: 12, name: 'Nope', reason: 'unparsed_sterilized' }])
  })
})

describe('census writes', () => {
  it('assigns the next shelter codes and keeps every import adult', () => {
    const plan = planCensusImport(parseCensusCsv(csv))
    const writes = assignCensusShelterCodes('AWS', ['AWS-0002'], plan.animals)
    expect(writes.map((write) => write.shelterCode)).toEqual([
      'AWS-0003',
      'AWS-0004',
      'AWS-0005',
      'AWS-0006',
      'AWS-0007',
      'AWS-0008',
      'AWS-0009',
    ])
    expect(new Set(writes.map((write) => write.shelterCode)).size).toBe(writes.length)
    expect(writes.every((write) => write.lifeStage === 'adult')).toBe(true)
    expect(writes.find((write) => write.name === 'Kit')).toMatchObject({ ageYears: 0, ageMonths: 8 })
    expect(writes.filter((write) => write.rowNumber === 3).map((write) => write.shelterCode)).toEqual([
      'AWS-0004',
      'AWS-0005',
    ])
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