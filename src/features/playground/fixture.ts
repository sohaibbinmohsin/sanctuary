/**
 * Curated playground demo data, mirrored from the live TOSC localhost/dev org
 * (Barnaby, Luna, Shadow, Jasper + ledger + public R2 photos).
 * Org is renamed to Playground so visitors don't confuse it with a real shelter.
 */

export type PlaygroundStatusFixture = {
  id: string
  label: string
  sortOrder: number
  countsAsInCare: boolean
}

export type PlaygroundCategoryFixture = {
  id: string
  label: string
  direction: 'in' | 'out'
}

export type PlaygroundAnimalFixture = {
  id: string
  shelterCode: string
  name: string
  species: string
  sex: string | null
  markings: string
  intakeDate: string
  statusLabel: string
  notes: string | null
  photoUrl: string
  /** Demo-only: show verified camera mark on this animal's seeded photo. */
  photoVerified?: boolean
}

export type PlaygroundTreatmentFixture = {
  animalId: string
  treatmentType: 'meds' | 'vet' | 'procedure' | 'other' | 'intake'
  notes: string
  treatedAt: string
}

export type PlaygroundLedgerFixture = {
  categoryLabel: string
  direction: 'in' | 'out'
  amountCents: number
  entryDate: string
  notes: string | null
}

export const PLAYGROUND_STATUSES: PlaygroundStatusFixture[] = [
  { id: 'b1111111-1111-4111-8111-111111111101', label: 'Intake', sortOrder: 1, countsAsInCare: true },
  { id: 'b1111111-1111-4111-8111-111111111102', label: 'Quarantine', sortOrder: 2, countsAsInCare: true },
  { id: 'b1111111-1111-4111-8111-111111111103', label: 'Treatment', sortOrder: 3, countsAsInCare: true },
  { id: 'b1111111-1111-4111-8111-111111111104', label: 'In sanctuary', sortOrder: 4, countsAsInCare: true },
  { id: 'b1111111-1111-4111-8111-111111111105', label: 'Transferred', sortOrder: 5, countsAsInCare: false },
  { id: 'b1111111-1111-4111-8111-111111111106', label: 'Deceased', sortOrder: 6, countsAsInCare: false },
  { id: 'b1111111-1111-4111-8111-111111111107', label: 'Adopted', sortOrder: 7, countsAsInCare: false },
]

export const PLAYGROUND_CATEGORIES: PlaygroundCategoryFixture[] = [
  { id: 'c1111111-1111-4111-8111-111111111101', label: 'Donation', direction: 'in' },
  { id: 'c1111111-1111-4111-8111-111111111102', label: 'Medical', direction: 'out' },
  { id: 'c1111111-1111-4111-8111-111111111103', label: 'Food', direction: 'out' },
  { id: 'c1111111-1111-4111-8111-111111111104', label: 'Supplies', direction: 'out' },
]

export const PLAYGROUND_ANIMALS: PlaygroundAnimalFixture[] = [
  {
    id: 'd1111111-1111-4111-8111-111111111101',
    shelterCode: 'PLAY-0001',
    name: 'Luna',
    species: 'Cat',
    sex: 'Female',
    markings: 'Black',
    intakeDate: '2026-07-09',
    statusLabel: 'Quarantine',
    notes: null,
    photoVerified: true,
    photoUrl:
      'https://pub-013d58bfca2d4cc4a607e56ffe23aa4f.r2.dev/2dd27176-42e2-4805-b8b0-a35f2e56a9c7/9dd087c4-5375-450e-8e5b-1d074b2adaf6/919a1da5-aa32-4021-bf1b-c81cbc02d171.jpg',
  },
  {
    id: 'd1111111-1111-4111-8111-111111111102',
    shelterCode: 'PLAY-0002',
    name: 'Barnaby',
    species: 'Dog',
    sex: null,
    markings: 'Tan body with a dark brown muzzle and floppy black-tipped ears',
    intakeDate: '2026-08-08',
    statusLabel: 'Quarantine',
    notes: 'Leash trained, highly energetic, responds well to treat rewards.',
    photoVerified: true,
    photoUrl:
      'https://pub-013d58bfca2d4cc4a607e56ffe23aa4f.r2.dev/2dd27176-42e2-4805-b8b0-a35f2e56a9c7/abd555d6-0b57-4a71-b69f-1fa938337eef/e160ddce-8489-4c20-8a1d-cea1d7aa575f.jpg',
  },
  {
    id: 'd1111111-1111-4111-8111-111111111103',
    shelterCode: 'PLAY-0003',
    name: 'Shadow',
    species: 'Cat',
    sex: 'Female',
    markings: 'All black coat with a small patch of white fur on her chest',
    intakeDate: '2026-06-11',
    statusLabel: 'Treatment',
    notes: null,
    photoUrl:
      'https://pub-013d58bfca2d4cc4a607e56ffe23aa4f.r2.dev/2dd27176-42e2-4805-b8b0-a35f2e56a9c7/251a4b6d-e279-479c-ad0f-f4d28464c6b5/a56edb4c-e5c2-46be-8a1a-af3ae6f74636.jpg',
  },
  {
    id: 'd1111111-1111-4111-8111-111111111104',
    shelterCode: 'PLAY-0004',
    name: 'Jasper',
    species: 'Cat',
    sex: 'Male',
    markings: 'Grey stripes with white paws and a notched left ear',
    intakeDate: '2026-02-01',
    statusLabel: 'In sanctuary',
    notes: 'Needs a routine vet checkup for a minor scratch on his left hind leg.',
    photoUrl:
      'https://pub-013d58bfca2d4cc4a607e56ffe23aa4f.r2.dev/2dd27176-42e2-4805-b8b0-a35f2e56a9c7/3214fff1-d76c-4870-9d08-76629c52d34e/ab3fd383-c485-4fa4-985e-88f52589bf11.jpg',
  },
]

export const PLAYGROUND_TREATMENTS: PlaygroundTreatmentFixture[] = [
  {
    animalId: 'd1111111-1111-4111-8111-111111111102',
    treatmentType: 'intake',
    notes: 'Leash trained, highly energetic, responds well to treat rewards.',
    treatedAt: '2026-08-08T12:00:00.000Z',
  },
  {
    animalId: 'd1111111-1111-4111-8111-111111111103',
    treatmentType: 'meds',
    notes: 'Started topical ointment for mild dermatitis on hind legs.',
    treatedAt: '2026-07-20T10:00:00.000Z',
  },
  {
    animalId: 'd1111111-1111-4111-8111-111111111104',
    treatmentType: 'vet',
    notes: 'Checked minor scratch on left hind leg — cleaning and monitoring.',
    treatedAt: '2026-07-15T09:30:00.000Z',
  },
  {
    animalId: 'd1111111-1111-4111-8111-111111111101',
    treatmentType: 'other',
    notes: 'Quarantine day 1 — eating well, no sneezing observed.',
    treatedAt: '2026-07-09T14:00:00.000Z',
  },
]

export const PLAYGROUND_LEDGER: PlaygroundLedgerFixture[] = [
  {
    categoryLabel: 'Donation',
    direction: 'in',
    amountCents: 2_000_000,
    entryDate: '2026-08-01',
    notes: null,
  },
  {
    categoryLabel: 'Food',
    direction: 'out',
    amountCents: 1_000_000,
    entryDate: '2026-08-05',
    notes: null,
  },
]
