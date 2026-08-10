import { describe, it, expect } from 'vitest'
import { buildPublicShelterDto } from '@/shared/lib/public/visibility'

describe('buildPublicShelterDto', () => {
  const base = {
    orgName: 'Tales of Second Chances',
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
    expect(dto.animals).toHaveLength(1)
    expect(dto.animals[0]!.care.map((c) => c.id)).toEqual(['c1'])
    expect(dto.animals[0]!.photos[0]!.verified).toBe(true)
  })

  it('omits hidden ledger rows and strips anonymous attachments', () => {
    const dto = buildPublicShelterDto(base)
    expect(dto.ledger.map((e) => e.id)).toEqual(['l1', 'l3'])
    expect(dto.ledger[0]!.attachmentUrls).toEqual([])
    expect(dto.ledger[1]!.attachmentUrls).toEqual(['https://cdn/bill.jpg'])
  })
})
