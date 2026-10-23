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

  const localMember = await db.getOptional<{ org_id: string }>(
    `SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1`,
    [userId],
  )
  if (localMember) {
    const statusCount = await db.getOptional<{ count: number }>(
      `SELECT count(*) as count FROM animal_statuses WHERE org_id = ? AND archived = 0`,
      [localMember.org_id],
    )
    const catCount = await db.getOptional<{ count: number }>(
      `SELECT count(*) as count FROM ledger_categories WHERE org_id = ? AND archived = 0`,
      [localMember.org_id],
    )
    if ((statusCount?.count ?? 0) > 0 && (catCount?.count ?? 0) > 0) {
      return false
    }
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
      'id, name, initials, logo_r2_key, public_enabled, public_slug, setup_completed, currency, created_at',
    )
    .in('id', orgIds)

  if (orgError) {
    console.warn('hydrate: organizations', orgError.message)
    return false
  }

  const { data: fetchedStatuses, error: statusError } = await supabase
    .from('animal_statuses')
    .select(
      'id, org_id, label, sort_order, counts_as_in_care, archived, created_at',
    )
    .in('org_id', orgIds)

  if (statusError) {
    console.warn('hydrate: animal_statuses', statusError.message)
    return false
  }

  const statuses = fetchedStatuses ? [...fetchedStatuses] : []
  for (const orgId of orgIds) {
    const hasOrgStatus = statuses.some((s) => s.org_id === orgId && !s.archived)
    if (!hasOrgStatus) {
      const defaultStatus = {
        id: crypto.randomUUID(),
        org_id: orgId,
        label: 'Intake',
        sort_order: 1,
        counts_as_in_care: true,
        archived: false,
        created_at: new Date().toISOString(),
      }
      statuses.push(defaultStatus)
      void supabase.from('animal_statuses').insert(defaultStatus)
    }
  }

  const { data: fetchedCategories, error: catError } = await supabase
    .from('ledger_categories')
    .select('id, org_id, label, direction, archived, created_at')
    .in('org_id', orgIds)

  if (catError) {
    console.warn('hydrate: ledger_categories', catError.message)
  }

  const categories = fetchedCategories ? [...fetchedCategories] : []
  for (const orgId of orgIds) {
    const hasOrgCat = categories.some((c) => c.org_id === orgId && !c.archived)
    if (!hasOrgCat) {
      const defaultCat = {
        id: crypto.randomUUID(),
        org_id: orgId,
        label: 'Food',
        direction: 'out',
        archived: false,
        created_at: new Date().toISOString(),
      }
      categories.push(defaultCat)
      void supabase.from('ledger_categories').insert(defaultCat)
    }
  }

  await db.writeTransaction(async (tx) => {
    for (const org of orgs ?? []) {
      await tx.execute(
        `INSERT OR REPLACE INTO organizations (id, name, initials, logo_r2_key, public_enabled, public_slug, setup_completed, currency, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          org.id,
          org.name,
          org.initials,
          org.logo_r2_key ?? null,
          boolToInt(org.public_enabled),
          org.public_slug ?? null,
          boolToInt(org.setup_completed),
          org.currency ?? 'PKR',
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
