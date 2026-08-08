import { useEffect, useState } from 'react'
import { usePowerSync } from '@powersync/react'
import { supabase } from '@/shared/lib/supabase'
import { asDb } from '@/shared/lib/db'
import { hydrateOrgBootstrap } from '@/features/sync/hydrateOrgBootstrap'

export type CurrentMember = {
  id: string
  orgId: string
  userId: string
  role: 'admin' | 'staff' | 'volunteer'
  orgName: string
  orgInitials: string
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
        const { data } = await supabase.auth.getSession()
        const userId = data.session?.user?.id
        if (!userId || !db) {
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
          }>(
            `SELECT m.id, m.org_id, m.user_id, m.role, o.name as org_name, o.initials as org_initials
             FROM org_members m
             JOIN organizations o ON o.id = m.org_id
             WHERE m.user_id = ?
             LIMIT 1`,
            [userId],
          )

        let row = await readMember()
        const statusCount = await db.getOptional<{ c: number }>(
          `SELECT COUNT(*) as c FROM animal_statuses`,
        )

        if (!row || (statusCount?.c ?? 0) === 0) {
          await hydrateOrgBootstrap(db)
          row = await readMember()
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
