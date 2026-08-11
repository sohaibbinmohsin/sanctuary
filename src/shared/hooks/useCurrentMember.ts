import { useEffect, useState } from 'react'
import { usePowerSync } from '@powersync/react'
import { supabase } from '@/shared/lib/supabase'
import { asDb } from '@/shared/lib/db'
import { hydrateOrgBootstrap } from '@/features/sync/hydrateOrgBootstrap'
import {
  isPlaygroundMode,
  PLAYGROUND_USER_ID,
} from '@/features/playground/mode'

export type CurrentMember = {
  id: string
  orgId: string
  userId: string
  role: 'admin' | 'staff' | 'volunteer'
  orgName: string
  orgInitials: string
  orgLogoR2Key: string | null
  publicEnabled: boolean
  publicSlug: string | null
}

export function useCurrentMember(): {
  member: CurrentMember | null
  loading: boolean
} {
  const powerSync = usePowerSync()
  const db = powerSync ? asDb(powerSync) : null
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        if (!db) {
          if (!cancelled) setMember(null)
          return
        }

        const playground = isPlaygroundMode()
        let userId: string | undefined

        if (playground) {
          userId = PLAYGROUND_USER_ID
        } else {
          const { data } = await supabase.auth.getSession()
          userId = data.session?.user?.id
        }

        if (!userId) {
          if (!cancelled) setMember(null)
          return
        }

        const readMember = () =>
          db.getOptional<{
            id: string
            org_id: string
            user_id: string
            role: string
            org_name: string
            org_initials: string
            org_logo_r2_key: string | null
            org_public_enabled: number | null
            org_public_slug: string | null
          }>(
            `SELECT m.id, m.org_id, m.user_id, m.role, o.name as org_name,
                    o.initials as org_initials, o.logo_r2_key as org_logo_r2_key,
                    o.public_enabled as org_public_enabled, o.public_slug as org_public_slug
             FROM org_members m
             JOIN organizations o ON o.id = m.org_id
             WHERE m.user_id = ?
             LIMIT 1`,
            [userId],
          )

        let row = await readMember()

        if (!playground) {
          const statusCount = await db.getOptional<{ c: number }>(
            `SELECT COUNT(*) as c FROM animal_statuses`,
          )

          if (!row || (statusCount?.c ?? 0) === 0) {
            await hydrateOrgBootstrap(db)
            row = await readMember()
          }
        }

        if (!cancelled) {
          setMember(
            row
              ? {
                  id: row.id,
                  orgId: row.org_id,
                  userId: row.user_id,
                  role: row.role as CurrentMember['role'],
                  orgName: row.org_name,
                  orgInitials: row.org_initials,
                  orgLogoR2Key: row.org_logo_r2_key ?? null,
                  publicEnabled: row.org_public_enabled === 1,
                  publicSlug: row.org_public_slug ?? null,
                }
              : null,
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [db])

  return { member, loading }
}
