import type { SanctuaryDb } from '@/shared/lib/db'
import { supabase } from '@/shared/lib/supabase'

function boolToInt(value: unknown): number {
  if (value === true || value === 1 || value === '1' || value === 't') return 1
  return 0
}

/**
 * When PowerSync has not synced yet, pull the signed-in user's org bootstrap
 * rows from Supabase into the local DB so the UI is usable.
 */
export async function hydrateOrgBootstrap(db: SanctuaryDb): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return false

  const localMember = await db.getOptional<{ id: string }>(
    `SELECT id FROM org_members WHERE user_id = ? LIMIT 1`,
    [userId],
  )
  if (localMember) {
    return false
  }

  const { data: memberships, error: memberError } = await supabase
    .from('org_members')
    .select('id, org_id, user_id, role, created_at')
    .eq('user_id', userId)

  if (memberError) {
    console.warn('hydrate: org_members', memberError.message)
    return false
  }
  if (!memberships?.length) {
    console.warn('hydrate: no org_members for user — was seed run?')
    return false
  }

  const orgIds = [...new Set(memberships.map((m) => m.org_id))]

  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select(
      'id, name, initials, logo_r2_key, public_enabled, public_slug, setup_completed, created_at',
    )
    .in('id', orgIds)

  if (orgError) {
    console.warn('hydrate: organizations', orgError.message)
    return false
  }

  const { data: statuses, error: statusError } = await supabase
    .from('animal_statuses')
    .select(
      'id, org_id, label, sort_order, counts_as_in_care, archived, created_at',
    )
    .in('org_id', orgIds)

  if (statusError) {
    console.warn('hydrate: animal_statuses', statusError.message)
    return false
  }

  const { data: categories, error: catError } = await supabase
    .from('ledger_categories')
    .select('id, org_id, label, direction, archived, created_at')
    .in('org_id', orgIds)

  if (catError) {
    console.warn('hydrate: ledger_categories', catError.message)
  }

  await db.writeTransaction(async (tx) => {
    for (const org of orgs ?? []) {
      await tx.execute(
        `INSERT OR REPLACE INTO organizations (id, name, initials, logo_r2_key, public_enabled, public_slug, setup_completed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          org.id,
          org.name,
          org.initials,
          org.logo_r2_key ?? null,
          boolToInt(org.public_enabled),
          org.public_slug ?? null,
          boolToInt(org.setup_completed),
          org.created_at ?? new Date().toISOString(),
        ],
      )
    }

    for (const m of memberships) {
      await tx.execute(
        `INSERT OR REPLACE INTO org_members (id, org_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          m.id,
          m.org_id,
          m.user_id,
          m.role,
          m.created_at ?? new Date().toISOString(),
        ],
      )
    }

    for (const s of statuses ?? []) {
      await tx.execute(
        `INSERT OR REPLACE INTO animal_statuses
          (id, org_id, label, sort_order, counts_as_in_care, archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.org_id,
          s.label,
          s.sort_order,
          boolToInt(s.counts_as_in_care),
          boolToInt(s.archived),
          s.created_at ?? new Date().toISOString(),
        ],
      )
    }

    for (const c of categories ?? []) {
      await tx.execute(
        `INSERT OR REPLACE INTO ledger_categories
          (id, org_id, label, direction, archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.org_id,
          c.label,
          c.direction,
          boolToInt(c.archived),
          c.created_at ?? new Date().toISOString(),
        ],
      )
    }
  })

  return true
}
