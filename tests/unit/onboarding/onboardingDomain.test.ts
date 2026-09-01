import { describe, it, expect, vi } from 'vitest'
import {
  DEFAULT_ONBOARDING_STATUSES,
  DEFAULT_ONBOARDING_CATEGORIES,
  commitOnboarding,
  type CommitOnboardingInput,
} from '@/features/onboarding/domain/onboarding'
import type { SanctuaryDb } from '@/shared/lib/db'
import * as partnerLogoModule from '@/features/settings/domain/partnerLogo'

describe('Onboarding domain', () => {
  it('provides sensible default statuses and ledger categories', () => {
    expect(DEFAULT_ONBOARDING_STATUSES.length).toBeGreaterThan(0)
    expect(DEFAULT_ONBOARDING_STATUSES.some((s) => s.label === 'Intake')).toBe(true)
    expect(DEFAULT_ONBOARDING_CATEGORIES.some((c) => c.label === 'Donation' && c.direction === 'in')).toBe(true)
    expect(DEFAULT_ONBOARDING_CATEGORIES.some((c) => c.label === 'Adoption fee')).toBe(false)
  })

  it('commits org identity, statuses, and ledger categories atomically', async () => {
    const executedSql: { sql: string; params?: unknown[] }[] = []
    const mockDb: SanctuaryDb = {
      execute: vi.fn(async (sql, params) => {
        executedSql.push({ sql, params })
      }),
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(async (fn) => {
        return await fn({
          execute: vi.fn(async (sql, params) => {
            executedSql.push({ sql, params })
          }),
          getAll: vi.fn(async () => []),
          getOptional: vi.fn(async () => null),
        } as unknown as SanctuaryDb)
      }),
    }

    const input: CommitOnboardingInput = {
      orgId: 'org-123',
      name: 'Safe Haven Sanctuary',
      initials: 'SHS',
      statuses: [
        { label: 'Intake', countsAsInCare: true },
        { label: 'Adopted', countsAsInCare: false },
      ],
      categories: [
        { label: 'Donation', direction: 'in' },
        { label: 'Food', direction: 'out' },
      ],
    }

    await commitOnboarding(mockDb, input)

    expect(
      executedSql.some(
        (e) =>
          e.sql.includes('UPDATE organizations SET name = ?') &&
          e.params?.[0] === 'Safe Haven Sanctuary' &&
          e.params?.[1] === 'SHS' &&
          e.params?.[2] === 'PKR' &&
          e.params?.[3] === 'org-123',
      ),
    ).toBe(true)
    expect(executedSql.some((e) => e.sql.includes('DELETE FROM animal_statuses WHERE org_id = ?'))).toBe(true)
    expect(executedSql.some((e) => e.sql.includes('INSERT INTO animal_statuses'))).toBe(true)
    expect(executedSql.some((e) => e.sql.includes('DELETE FROM ledger_categories WHERE org_id = ?'))).toBe(true)
    expect(executedSql.some((e) => e.sql.includes('INSERT INTO ledger_categories'))).toBe(true)
  })

  it('derives initials from name if initials is empty', async () => {
    const executedSql: { sql: string; params?: unknown[] }[] = []
    const mockDb: SanctuaryDb = {
      execute: vi.fn(async (sql, params) => {
        executedSql.push({ sql, params })
      }),
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(async (fn) => {
        return await fn({
          execute: vi.fn(async (sql, params) => {
            executedSql.push({ sql, params })
          }),
          getAll: vi.fn(async () => []),
          getOptional: vi.fn(async () => null),
        } as unknown as SanctuaryDb)
      }),
    }

    const input: CommitOnboardingInput = {
      orgId: 'org-123',
      name: 'Paws Rescue',
      initials: '',
      statuses: [{ label: 'Intake', countsAsInCare: true }],
      categories: [{ label: 'Donation', direction: 'in' }],
    }

    await commitOnboarding(mockDb, input)

    expect(
      executedSql.some(
        (e) =>
          e.sql.includes('UPDATE organizations SET name = ?') &&
          e.params?.[0] === 'Paws Rescue' &&
          e.params?.[1] === 'PAW' &&
          e.params?.[2] === 'PKR' &&
          e.params?.[3] === 'org-123',
      ),
    ).toBe(true)
  })

  it('saves custom currency (e.g. USD) when provided', async () => {
    const executedSql: { sql: string; params?: unknown[] }[] = []
    const mockDb: SanctuaryDb = {
      execute: vi.fn(async (sql, params) => {
        executedSql.push({ sql, params })
      }),
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(async (fn) => {
        return await fn({
          execute: vi.fn(async (sql, params) => {
            executedSql.push({ sql, params })
          }),
          getAll: vi.fn(async () => []),
          getOptional: vi.fn(async () => null),
        } as unknown as SanctuaryDb)
      }),
    }

    const input: CommitOnboardingInput = {
      orgId: 'org-456',
      name: 'Global Shelter',
      initials: 'GS',
      currency: 'USD',
      statuses: [{ label: 'Intake', countsAsInCare: true }],
      categories: [{ label: 'Donation', direction: 'in' }],
    }

    await commitOnboarding(mockDb, input)

    expect(
      executedSql.some(
        (e) =>
          e.sql.includes('UPDATE organizations SET name = ?') &&
          e.params?.[0] === 'Global Shelter' &&
          e.params?.[1] === 'GS' &&
          e.params?.[2] === 'USD' &&
          e.params?.[3] === 'org-456',
      ),
    ).toBe(true)
  })

  it('calls setPartnerLogo if logoFile is provided', async () => {
    const mockDb: SanctuaryDb = {
      execute: vi.fn(async () => {}),
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
      writeTransaction: vi.fn(async (fn) => {
        return await fn(mockDb)
      }),
    }

    const setLogoSpy = vi.spyOn(partnerLogoModule, 'setPartnerLogo').mockResolvedValue('local')

    const fakeFile = new File(['dummy'], 'logo.png', { type: 'image/png' })
    const input: CommitOnboardingInput = {
      orgId: 'org-123',
      name: 'Paws Rescue',
      initials: 'PR',
      logoFile: fakeFile,
      statuses: [{ label: 'Intake', countsAsInCare: true }],
      categories: [{ label: 'Donation', direction: 'in' }],
    }

    await commitOnboarding(mockDb, input)

    expect(setLogoSpy).toHaveBeenCalledWith(mockDb, 'org-123', fakeFile)
    setLogoSpy.mockRestore()
  })

  it('validates shelter name is required', async () => {
    const mockDb = {} as SanctuaryDb
    const input: CommitOnboardingInput = {
      orgId: 'org-123',
      name: '   ',
      initials: '',
      statuses: [{ label: 'Intake', countsAsInCare: true }],
      categories: [{ label: 'Donation', direction: 'in' }],
    }

    await expect(commitOnboarding(mockDb, input)).rejects.toThrow('Enter your shelter name.')
  })

  it('validates at least one animal status is required', async () => {
    const mockDb = {} as SanctuaryDb
    const input: CommitOnboardingInput = {
      orgId: 'org-123',
      name: 'Valid Name',
      initials: 'VN',
      statuses: [{ label: '   ', countsAsInCare: true }],
      categories: [{ label: 'Donation', direction: 'in' }],
    }

    await expect(commitOnboarding(mockDb, input)).rejects.toThrow('Add at least one animal status.')
  })

  it('validates at least one ledger category is required', async () => {
    const mockDb = {} as SanctuaryDb
    const input: CommitOnboardingInput = {
      orgId: 'org-123',
      name: 'Valid Name',
      initials: 'VN',
      statuses: [{ label: 'Intake', countsAsInCare: true }],
      categories: [{ label: '   ', direction: 'in' }],
    }

    await expect(commitOnboarding(mockDb, input)).rejects.toThrow('Add at least one ledger category.')
  })
})
