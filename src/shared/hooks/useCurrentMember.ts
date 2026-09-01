import { useEffect, useMemo, useRef, useState } from 'react'
import { usePowerSync, useQuery } from '@powersync/react'
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
  setupCompleted: boolean
}

export type MemberRow = {
  id: string
  org_id: string
  user_id: string
  role: string
  org_name: string
  org_initials: string
  org_logo_r2_key: string | null
  org_public_enabled: number | null
  org_public_slug: string | null
  org_setup_completed: number | null
}

export function mapMemberRow(row: MemberRow): CurrentMember {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role as CurrentMember['role'],
    orgName: row.org_name,
    orgInitials: row.org_initials,
    orgLogoR2Key: row.org_logo_r2_key ?? null,
    publicEnabled: row.org_public_enabled === 1,
    publicSlug: row.org_public_slug ?? null,
    setupCompleted: row.org_setup_completed === 1,
  }
}

export function useCurrentMember(): {
  member: CurrentMember | null
  loading: boolean
} {
  const powerSync = usePowerSync()
  const db = powerSync ? asDb(powerSync) : null
  const playground = isPlaygroundMode()
  const hydratedRef = useRef(false)

  const [userId, setUserId] = useState<string | undefined>(
    playground ? PLAYGROUND_USER_ID : undefined,
  )
  const [authLoading, setAuthLoading] = useState(!playground)

  useEffect(() => {
    if (playground) return
    let mounted = true
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (mounted) {
          setUserId(data.session?.user?.id)
        }
      } finally {
        if (mounted) setAuthLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [playground])

  const query = userId
    ? `SELECT m.id, m.org_id, m.user_id, m.role, o.name as org_name,
              o.initials as org_initials, o.logo_r2_key as org_logo_r2_key,
              o.public_enabled as org_public_enabled, o.public_slug as org_public_slug,
              o.setup_completed as org_setup_completed
       FROM org_members m
       JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = ?
       LIMIT 1`
    : `SELECT 1 WHERE 0`

  const { data: memberRows = [], isLoading: queryLoading } = useQuery<MemberRow>(
    query,
    userId ? [userId] : [],
  )

  const [hydrating, setHydrating] = useState(false)

  useEffect(() => {
    if (!db || playground || !userId || authLoading || queryLoading) return
    if (memberRows.length === 0 && !hydratedRef.current) {
      hydratedRef.current = true
      setHydrating(true)
      void hydrateOrgBootstrap(db).finally(() => {
        setHydrating(false)
      })
    }
  }, [db, playground, userId, authLoading, queryLoading, memberRows.length])

  const row = memberRows[0]
  const member = useMemo(
    () => (row ? mapMemberRow(row) : null),
    [
      row?.id,
      row?.org_id,
      row?.user_id,
      row?.role,
      row?.org_name,
      row?.org_initials,
      row?.org_logo_r2_key,
      row?.org_public_enabled,
      row?.org_public_slug,
      row?.org_setup_completed,
    ],
  )
  const loading =
    authLoading || (userId ? queryLoading || hydrating : false)

  return { member, loading }
}
