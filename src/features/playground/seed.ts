import type { AbstractPowerSyncDatabase } from '@powersync/web'
import { asDb, type SanctuaryDb } from '@/shared/lib/db'
import {
  PLAYGROUND_ANIMALS,
  PLAYGROUND_CATEGORIES,
  PLAYGROUND_LEDGER,
  PLAYGROUND_STATUSES,
  PLAYGROUND_TREATMENTS,
} from '@/features/playground/fixture'
import {
  PLAYGROUND_MEMBER_ID,
  PLAYGROUND_ORG_ID,
  PLAYGROUND_ORG_INITIALS,
  PLAYGROUND_ORG_NAME,
  PLAYGROUND_SEED_VERSION,
  PLAYGROUND_USER_ID,
} from '@/features/playground/mode'

const SEED_VERSION_KEY = 'sanctuary.playground.seedVersion'

function readStoredSeedVersion(): number {
  try {
    const raw = localStorage.getItem(SEED_VERSION_KEY)
    if (!raw) return 0
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeStoredSeedVersion(): void {
  try {
    localStorage.setItem(SEED_VERSION_KEY, String(PLAYGROUND_SEED_VERSION))
  } catch {
    // Private mode / blocked storage — next visit may re-seed again.
  }
}

async function seedInto(db: SanctuaryDb): Promise<void> {
  const now = new Date().toISOString()

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO organizations (id, name, initials, logo_r2_key, created_at) VALUES (?, ?, ?, NULL, ?)`,
      [PLAYGROUND_ORG_ID, PLAYGROUND_ORG_NAME, PLAYGROUND_ORG_INITIALS, now],
    )

    await tx.execute(
      `INSERT INTO org_members (id, org_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`,
      [PLAYGROUND_MEMBER_ID, PLAYGROUND_ORG_ID, PLAYGROUND_USER_ID, 'admin', now],
    )

    for (const status of PLAYGROUND_STATUSES) {
      await tx.execute(
        `INSERT INTO animal_statuses (
          id, org_id, label, sort_order, counts_as_in_care, archived, created_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [
          status.id,
          PLAYGROUND_ORG_ID,
          status.label,
          status.sortOrder,
          status.countsAsInCare ? 1 : 0,
          now,
        ],
      )
    }

    for (const category of PLAYGROUND_CATEGORIES) {
      await tx.execute(
        `INSERT INTO ledger_categories (
          id, org_id, label, direction, archived, created_at
        ) VALUES (?, ?, ?, ?, 0, ?)`,
        [category.id, PLAYGROUND_ORG_ID, category.label, category.direction, now],
      )
    }

    const statusByLabel = new Map(PLAYGROUND_STATUSES.map((s) => [s.label, s.id]))
    const categoryByLabel = new Map(
      PLAYGROUND_CATEGORIES.map((c) => [c.label, c.id]),
    )

    for (const animal of PLAYGROUND_ANIMALS) {
      const statusId = statusByLabel.get(animal.statusLabel)
      if (!statusId) {
        throw new Error(`Missing status for ${animal.statusLabel}`)
      }

      await tx.execute(
        `INSERT INTO animals (
          id, org_id, shelter_code, name, species, sex, markings,
          intake_date, status_id, notes, archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          animal.id,
          PLAYGROUND_ORG_ID,
          animal.shelterCode,
          animal.name,
          animal.species,
          animal.sex,
          animal.markings,
          animal.intakeDate,
          statusId,
          animal.notes,
          now,
          now,
        ],
      )

      await tx.execute(
        `INSERT INTO animal_status_assignments (
          id, org_id, animal_id, status_id, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          PLAYGROUND_ORG_ID,
          animal.id,
          statusId,
          now,
        ],
      )

      await tx.execute(
        `INSERT INTO photos (
          id, org_id, animal_id, r2_key, local_only, upload_state,
          capture_source, verified, created_at
        ) VALUES (?, ?, ?, ?, 0, 'uploaded', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          PLAYGROUND_ORG_ID,
          animal.id,
          animal.photoUrl,
          animal.photoVerified ? 'camera' : 'gallery',
          animal.photoVerified ? 1 : 0,
          now,
        ],
      )
    }

    for (const treatment of PLAYGROUND_TREATMENTS) {
      await tx.execute(
        `INSERT INTO treatments (
          id, org_id, animal_id, treated_at, treatment_type, notes, ledger_entry_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          crypto.randomUUID(),
          PLAYGROUND_ORG_ID,
          treatment.animalId,
          treatment.treatedAt,
          treatment.treatmentType,
          treatment.notes,
          now,
        ],
      )
    }

    for (const entry of PLAYGROUND_LEDGER) {
      const categoryId = categoryByLabel.get(entry.categoryLabel)
      if (!categoryId) {
        throw new Error(`Missing category for ${entry.categoryLabel}`)
      }
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, org_id, category_id, direction, amount_cents, entry_date, notes, animal_id, is_anonymous, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)`,
        [
          crypto.randomUUID(),
          PLAYGROUND_ORG_ID,
          categoryId,
          entry.direction,
          entry.amountCents,
          entry.entryDate,
          entry.notes,
          now,
        ],
      )
    }
  })
}

async function playgroundAnimalCount(db: SanctuaryDb): Promise<number> {
  const row = await db.getOptional<{ c: number }>(
    `SELECT COUNT(*) as c FROM animals WHERE org_id = ?`,
    [PLAYGROUND_ORG_ID],
  )
  return row?.c ?? 0
}

/**
 * Ensure playground demo data matches {@link PLAYGROUND_SEED_VERSION}.
 * Empty DB or a version mismatch wipes local playground data and re-seeds.
 */
export async function ensurePlaygroundSeed(
  powerSync: AbstractPowerSyncDatabase,
): Promise<void> {
  const db = asDb(powerSync)
  const versionMatches = readStoredSeedVersion() === PLAYGROUND_SEED_VERSION
  const hasAnimals = (await playgroundAnimalCount(db)) > 0

  if (versionMatches && hasAnimals) return

  await powerSync.disconnectAndClear()

  try {
    await seedInto(asDb(powerSync))
    writeStoredSeedVersion()
  } catch (err) {
    console.error('Playground seed failed', err)
    throw err
  }
}

/** Wipe playground local DB and re-seed demo data. */
export async function resetPlaygroundSeed(
  powerSync: AbstractPowerSyncDatabase,
): Promise<void> {
  try {
    localStorage.removeItem(SEED_VERSION_KEY)
  } catch {
    // ignore
  }
  await powerSync.disconnectAndClear()
  await ensurePlaygroundSeed(powerSync)
}
