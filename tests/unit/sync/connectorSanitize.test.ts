import { describe, expect, it } from 'vitest'
import { sanitizeForPostgres } from '@/features/sync/powersync/connector'

describe('sanitizeForPostgres', () => {
  it('converts animal_statuses integer booleans to native booleans', () => {
    const input = {
      id: 'status-1',
      org_id: 'org-1',
      label: 'Intake',
      sort_order: 1,
      counts_as_in_care: 1,
      archived: 0,
    }
    const output = sanitizeForPostgres('animal_statuses', input)
    expect(output).toEqual({
      id: 'status-1',
      org_id: 'org-1',
      label: 'Intake',
      sort_order: 1,
      counts_as_in_care: true,
      archived: false,
    })
  })

  it('converts ledger_categories integer booleans to native booleans', () => {
    const input = {
      id: 'cat-1',
      org_id: 'org-1',
      label: 'Donation',
      direction: 'in',
      archived: 0,
    }
    const output = sanitizeForPostgres('ledger_categories', input)
    expect(output).toEqual({
      id: 'cat-1',
      org_id: 'org-1',
      label: 'Donation',
      direction: 'in',
      archived: false,
    })
  })

  it('converts organizations setup_completed and public_enabled to booleans', () => {
    const input = {
      id: 'org-1',
      name: 'Shelter',
      initials: 'SH',
      setup_completed: 1,
      public_enabled: 0,
    }
    const output = sanitizeForPostgres('organizations', input)
    expect(output).toEqual({
      id: 'org-1',
      name: 'Shelter',
      initials: 'SH',
      setup_completed: true,
      public_enabled: false,
    })
  })

  it('leaves non-boolean tables untouched', () => {
    const input = {
      id: 'member-1',
      org_id: 'org-1',
      user_id: 'user-1',
      role: 'admin',
    }
    const output = sanitizeForPostgres('org_members', input)
    expect(output).toEqual(input)
  })
})
