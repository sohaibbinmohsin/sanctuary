import { describe, it, expect } from 'vitest'
import { mapMemberRow, type CurrentMember } from '@/shared/hooks/useCurrentMember'

describe('CurrentMember setupCompleted parsing', () => {
  it('correctly maps setup_completed integer to boolean', () => {
    const memberTrue: CurrentMember = {
      id: 'm1',
      orgId: 'o1',
      userId: 'u1',
      role: 'admin',
      orgName: 'Shelter A',
      orgInitials: 'SA',
      orgLogoR2Key: null,
      publicEnabled: false,
      publicSlug: null,
      setupCompleted: true,
    }
    expect(memberTrue.setupCompleted).toBe(true)

    const memberFalse: CurrentMember = {
      ...memberTrue,
      setupCompleted: false,
    }
    expect(memberFalse.setupCompleted).toBe(false)
  })

  it('maps raw database row with org_setup_completed 1 to setupCompleted true', () => {
    const row = {
      id: 'm1',
      org_id: 'o1',
      user_id: 'u1',
      role: 'admin',
      org_name: 'Shelter A',
      org_initials: 'SA',
      org_logo_r2_key: null,
      org_public_enabled: 0,
      org_public_slug: null,
      org_setup_completed: 1,
    }
    const member = mapMemberRow(row)
    expect(member.setupCompleted).toBe(true)
  })

  it('maps raw database row with org_setup_completed 0 or null to setupCompleted false', () => {
    const row0 = {
      id: 'm1',
      org_id: 'o1',
      user_id: 'u1',
      role: 'admin',
      org_name: 'Shelter A',
      org_initials: 'SA',
      org_logo_r2_key: null,
      org_public_enabled: 0,
      org_public_slug: null,
      org_setup_completed: 0,
    }
    expect(mapMemberRow(row0).setupCompleted).toBe(false)

    const rowNull = {
      ...row0,
      org_setup_completed: null,
    }
    expect(mapMemberRow(rowNull).setupCompleted).toBe(false)
  })
})

