export type PublicPhotoDto = {
  id: string
  url: string
  verified: boolean
}

export type PublicCareDto = {
  id: string
  treatedAt: string
  treatmentType: string
  notes: string | null
}

export type PublicAnimalDto = {
  id: string
  shelterCode: string
  name: string | null
  species: string | null
  sex: string | null
  markings: string | null
  statusLabel: string
  photos: PublicPhotoDto[]
  care: PublicCareDto[]
}

export type PublicLedgerDto = {
  id: string
  direction: 'in' | 'out'
  amountCents: number
  entryDate: string
  categoryLabel: string
  notes: string | null
  animalId: string | null
  isAnonymous: boolean
  /** Always empty when isAnonymous; otherwise public attachment URLs if any. */
  attachmentUrls: string[]
}

export type PublicShelterDto = {
  orgName: string
  slug: string
  animals: PublicAnimalDto[]
  ledger: PublicLedgerDto[]
}

type PublicPhotoInput = PublicPhotoDto

type PublicCareInput = PublicCareDto & {
  hideFromPublic: boolean
}

type PublicAnimalInput = Omit<PublicAnimalDto, 'photos' | 'care'> & {
  archived: boolean
  countsAsInCare: boolean
  photos: PublicPhotoInput[]
  care: PublicCareInput[]
}

type PublicLedgerInput = Omit<PublicLedgerDto, 'attachmentUrls'> & {
  hideFromPublic: boolean
  attachmentUrls: string[]
}

export type PublicShelterInput = Omit<PublicShelterDto, 'animals' | 'ledger'> & {
  animals: PublicAnimalInput[]
  ledger: PublicLedgerInput[]
}

export function buildPublicShelterDto(input: PublicShelterInput): PublicShelterDto {
  return {
    orgName: input.orgName,
    slug: input.slug,
    animals: input.animals
      .filter((animal) => !animal.archived && animal.countsAsInCare)
      .map(({ archived: _archived, countsAsInCare: _countsAsInCare, photos, care, ...animal }) => ({
        ...animal,
        photos: photos.map(({ id, url, verified }) => ({ id, url, verified })),
        care: care
          .filter((entry) => !entry.hideFromPublic)
          .map(({ id, treatedAt, treatmentType, notes }) => ({
            id,
            treatedAt,
            treatmentType,
            notes,
          })),
      })),
    ledger: input.ledger
      .filter((entry) => !entry.hideFromPublic)
      .map(({ hideFromPublic: _hideFromPublic, attachmentUrls, ...entry }) => ({
        ...entry,
        attachmentUrls: entry.isAnonymous ? [] : attachmentUrls,
      })),
  }
}
