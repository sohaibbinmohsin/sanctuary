import { describe, it, expect } from 'vitest'
import { buildPublicShelterDto } from '@/shared/lib/public/visibility'

describe('buildPublicShelterDto', () => {
  const base = {
    orgName: 'Tales of Second Chances',
    logoUrl: 'https://cdn/logo.png',
    slug: 'tosc',
    animals: [
      {
        id: 'a1',
        shelterCode: 'TOSC-0001',
        name: 'Barnaby',
        species: 'dog',
        sex: 'male',
        markings: null,
        statusLabel: 'In sanctuary',
        archived: false,
        countsAsInCare: true,
        photos: [
          { id: 'p1', url: 'https://cdn/p1.jpg', verified: true },
          { id: 'p2', url: 'https://cdn/p2.jpg', verified: false },
        ],
        care: [
          {
            id: 'c1',
            treatedAt: '2026-01-01',
            treatmentType: 'meds',
            notes: 'visible',
            hideFromPublic: false,
          },
          {
            id: 'c2',
            treatedAt: '2026-01-02',
            treatmentType: 'vet',
            notes: 'secret',
            hideFromPublic: true,
          },
        ],
      },
      {
        id: 'a2',
        shelterCode: 'TOSC-0002',
        name: 'Gone',
        species: 'cat',
        sex: null,
        markings: null,
        statusLabel: 'Adopted',
        archived: false,
        countsAsInCare: false,
        photos: [],
        care: [],
      },
    ],
    ledger: [
      {
        id: 'l1',
        direction: 'in' as const,
        amountCents: 500000,
        entryDate: '2026-01-03',
        categoryLabel: 'Donation',
        notes: 'Thanks',
        animalId: null,
        isAnonymous: true,
        hideFromPublic: false,
        attachmentUrls: ['https://cdn/receipt.jpg'],
      },
      {
        id: 'l2',
        direction: 'out' as const,
        amountCents: 10000,
        entryDate: '2026-01-04',
        categoryLabel: 'Food',
        notes: null,
        animalId: 'a1',
        isAnonymous: false,
        hideFromPublic: true,
        attachmentUrls: [],
      },
      {
        id: 'l3',
        direction: 'out' as const,
        amountCents: 20000,
        entryDate: '2026-01-05',
        categoryLabel: 'Vet',
        notes: 'Clinic',
        animalId: 'a1',
        isAnonymous: false,
        hideFromPublic: false,
        attachmentUrls: ['https://cdn/bill.jpg'],
      },
    ],
  }

  it('keeps in-care animals, strips hidden care, keeps verified flags', () => {
    const dto = buildPublicShelterDto(base)
    expect(dto.logoUrl).toBe('https://cdn/logo.png')
    expect(dto.animals).toHaveLength(1)
    expect(dto.animals[0]!.care.map((c) => c.id)).toEqual(['c1'])
    expect(dto.animals[0]!.photos[0]!.verified).toBe(true)
  })

  it('synthesizes Arrived from intakeDate when no arrival care exists', () => {
    const dto = buildPublicShelterDto({
      ...base,
      animals: [
        {
          ...base.animals[0]!,
          intakeDate: '2026-01-01',
          care: [
            {
              id: 'c-status',
              treatedAt: '2026-01-05T10:00:00.000Z',
              treatmentType: 'status',
              notes: 'In sanctuary',
              hideFromPublic: false,
            },
          ],
        },
      ],
    })
    expect(dto.animals[0]!.care.map((c) => c.treatmentType)).toEqual([
      'status',
      'arrived',
    ])
    expect(dto.animals[0]!.care[1]!.treatedAt).toBe(
      new Date('2026-01-01T12:00:00').toISOString(),
    )
  })

  it('does not synthesize Arrived when an arrival care row already exists', () => {
    const dto = buildPublicShelterDto({
      ...base,
      animals: [
        {
          ...base.animals[0]!,
          intakeDate: '2026-01-01',
          care: [
            {
              id: 'c-arrived',
              treatedAt: '2026-01-01T12:00:00.000Z',
              treatmentType: 'arrived',
              notes: 'Friendly',
              hideFromPublic: false,
            },
          ],
        },
      ],
    })
    expect(dto.animals[0]!.care).toHaveLength(1)
    expect(dto.animals[0]!.care[0]!.notes).toBe('Friendly')
  })

  it('omits hidden ledger rows and strips anonymous attachments', () => {
    const dto = buildPublicShelterDto(base)
    expect(dto.ledger.map((e) => e.id)).toEqual(['l1', 'l3'])
    expect(dto.ledger[0]!.attachmentUrls).toEqual([])
    expect(dto.ledger[1]!.attachmentUrls).toEqual(['https://cdn/bill.jpg'])
  })

  it('drops notes on anonymous ledger rows so donor names cannot leak', () => {
    const dto = buildPublicShelterDto(base)
    expect(dto.ledger[0]!.isAnonymous).toBe(true)
    expect(dto.ledger[0]!.notes).toBeNull()
    expect(dto.ledger[1]!.notes).toBe('Clinic')
  })
})
