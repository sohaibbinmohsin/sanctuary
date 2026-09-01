import type { SanctuaryDb } from '@/shared/lib/db'
import type { LedgerDirection } from '@/features/ledger/domain/ledger'
import { setPartnerLogo } from '@/features/settings/domain/partnerLogo'

export type StatusDraft = {
  id?: string
  label: string
  countsAsInCare: boolean
}

export type CategoryDraft = {
  id?: string
  label: string
  direction: LedgerDirection
}

export const DEFAULT_ONBOARDING_STATUSES: readonly StatusDraft[] = [
  { label: 'Intake', countsAsInCare: true },
  { label: 'Quarantine', countsAsInCare: true },
  { label: 'Treatment', countsAsInCare: true },
  { label: 'In sanctuary', countsAsInCare: true },
  { label: 'Adopted', countsAsInCare: false },
  { label: 'Transferred', countsAsInCare: false },
  { label: 'Deceased', countsAsInCare: false },
]

export const DEFAULT_ONBOARDING_CATEGORIES: readonly CategoryDraft[] = [
  { label: 'Donation', direction: 'in' },
  { label: 'Food & Nutrition', direction: 'out' },
  { label: 'Medical & Vet', direction: 'out' },
  { label: 'Supplies & Bedding', direction: 'out' },
  { label: 'Facility & Operations', direction: 'out' },
]

export type CommitOnboardingInput = {
  orgId: string
  name: string
  initials: string
  logoFile?: File | null
  statuses: StatusDraft[]
  categories: CategoryDraft[]
}

export async function commitOnboarding(
  db: SanctuaryDb,
  input: CommitOnboardingInput,
): Promise<void> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Enter your shelter name.')
  }
  const initials = input.initials.trim() || name.slice(0, 3).toUpperCase()
  const filteredStatuses = input.statuses
    .map((s) => ({ ...s, label: s.label.trim() }))
    .filter((s) => Boolean(s.label))

  if (filteredStatuses.length === 0) {
    throw new Error('Add at least one animal status.')
  }

  const filteredCategories = input.categories
    .map((c) => ({ ...c, label: c.label.trim() }))
    .filter((c) => Boolean(c.label))

  if (filteredCategories.length === 0) {
    throw new Error('Add at least one ledger category.')
  }

  if (input.logoFile) {
    await setPartnerLogo(db, input.orgId, input.logoFile)
  }

  const now = new Date().toISOString()

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE organizations SET name = ?, initials = ?, setup_completed = 1 WHERE id = ?`,
      [name, initials, input.orgId],
    )

    await tx.execute(`DELETE FROM animal_statuses WHERE org_id = ?`, [input.orgId])
    for (let i = 0; i < filteredStatuses.length; i++) {
      const s = filteredStatuses[i]
      const statusId = s.id || crypto.randomUUID()
      await tx.execute(
        `INSERT INTO animal_statuses (id, org_id, label, sort_order, counts_as_in_care, archived, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [statusId, input.orgId, s.label, i + 1, s.countsAsInCare ? 1 : 0, now],
      )
    }

    await tx.execute(`DELETE FROM ledger_categories WHERE org_id = ?`, [input.orgId])
    for (const c of filteredCategories) {
      const catId = c.id || crypto.randomUUID()
      await tx.execute(
        `INSERT INTO ledger_categories (id, org_id, label, direction, archived, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [catId, input.orgId, c.label, c.direction, now],
      )
    }
  })
}
