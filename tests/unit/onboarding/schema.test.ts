import { describe, it, expect } from 'vitest'
import { schema } from '@/features/sync/powersync/schema'

describe('PowerSync schema setup_completed', () => {
  it('includes setup_completed column in organizations table', () => {
    const orgsTable = schema.tables.find((t) => t.name === 'organizations')
    expect(orgsTable).toBeDefined()
    const col = orgsTable?.columns.find((c) => c.name === 'setup_completed')
    expect(col).toBeDefined()
    expect(col?.type).toBe('INTEGER')
  })

  it('includes currency column in organizations table', () => {
    const orgsTable = schema.tables.find((t) => t.name === 'organizations')
    expect(orgsTable).toBeDefined()
    const col = orgsTable?.columns.find((c) => c.name === 'currency')
    expect(col).toBeDefined()
    expect(col?.type).toBe('TEXT')
  })
})
