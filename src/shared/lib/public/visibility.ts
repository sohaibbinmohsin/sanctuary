import { compareCareNewestFirst, isArrivalCareType } from '@/shared/lib/public/format'
import { arrivalTimestampFromIntakeDate } from '@/shared/lib/dates'

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
  currency?: 'PKR' | 'USD'
  entryDate: string
  categoryLabel: string
  /** Always null when isAnonymous — notes can name the donor. */
  notes: string | null
  animalId: string | null
  isAnonymous: boolean
  /** Always empty when isAnonymous; otherwise public attachment URLs if any. */
  attachmentUrls: string[]
}

export type PublicShelterDto = {
  orgName: string
  /** Partner org logo public URL, when set. */
  logoUrl: string | null
  slug: string
  currency?: 'PKR' | 'USD'
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
  /** Date-only intake; used to synthesize a public Arrived row when no arrival care exists. */
  intakeDate?: string | null
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
    logoUrl: input.logoUrl ?? null,
    slug: input.slug,
    currency: input.currency ?? 'PKR',
    animals: input.animals
      .filter((animal) => !animal.archived && animal.countsAsInCare)
      .map(
        ({
          archived: _archived,
          countsAsInCare: _countsAsInCare,
          intakeDate,
          photos,
          care,
          ...animal
        }) => {
          const publicCare = care
            .filter((entry) => !entry.hideFromPublic)
            .map(({ id, treatedAt, treatmentType, notes }) => ({
              id,
              treatedAt,
              treatmentType,
              notes,
            }))

          const hasArrival = publicCare.some((entry) =>
            isArrivalCareType(entry.treatmentType),
          )
          if (!hasArrival && intakeDate) {
            publicCare.push({
              id: `${animal.id}-arrived`,
              treatedAt: intakeDate.includes('T')
                ? intakeDate
                : arrivalTimestampFromIntakeDate(intakeDate),
              treatmentType: 'arrived',
              notes: null,
            })
          }

          publicCare.sort(compareCareNewestFirst)

          return {
            ...animal,
            photos: photos.map(({ id, url, verified }) => ({
              id,
              url,
              verified,
            })),
            care: publicCare,
          }
        },
      ),
    ledger: input.ledger
      .filter((entry) => !entry.hideFromPublic)
      .map(({ hideFromPublic: _hideFromPublic, attachmentUrls, ...entry }) => ({
        ...entry,
        notes: entry.isAnonymous ? null : entry.notes,
        attachmentUrls: entry.isAnonymous ? [] : attachmentUrls,
      })),
  }
}
