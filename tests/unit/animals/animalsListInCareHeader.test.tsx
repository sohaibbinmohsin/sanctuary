import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import * as animalsDomain from '@/features/animals/domain/animals'
import type { AnimalWithStatus } from '@/features/animals/domain/animals'

const queries = vi.hoisted(() => [] as { sql: string; params: unknown[] }[])

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    getOptional: vi.fn().mockResolvedValue(null),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'TS', orgName: 'Test Shelter' },
    loading: false,
  }),
}))

vi.mock('@/shared/hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    kind: 'synced',
    hasSynced: true,
    status: 'connected',
    pendingCount: 0,
    downloading: false,
    uploading: false,
    errorMessage: null,
  }),
}))

vi.mock('@powersync/react', () => ({
  useQuery: (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    const countsOnlyInCare = /counts_as_in_care\s*=\s*1/i.test(sql)
    return { data: [{ n: countsOnlyInCare ? 1 : 2, total: 2 }] }
  },
}))

function animal(
  overrides: Partial<AnimalWithStatus> & Pick<AnimalWithStatus, 'id' | 'name'>,
): AnimalWithStatus {
  return {
    org_id: 'org-1',
    shelter_code: overrides.id,
    species: 'Dog',
    intake_date: '2026-10-01',
    status_id: 'st-intake',
    status_label: 'Intake',
    status_labels: ['Intake'],
    sex: null,
    markings: null,
    notes: null,
    life_stage: 'adult',
    archived: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

const inCareDog = animal({
  id: 'in-care',
  name: 'In Care Dog',
  shelter_code: 'TS-0001',
  status_label: 'Intake',
  status_labels: ['Intake'],
})

const transferredCat = animal({
  id: 'transferred',
  name: 'Transferred Cat',
  shelter_code: 'TS-0002',
  species: 'Cat',
  status_id: 'st-transferred',
  status_label: 'Transferred',
  status_labels: ['Transferred'],
})

describe('Animals list in-care header', () => {
  it('counts only in-care animals in the header while still listing a transferred animal', async () => {
    queries.length = 0
    vi.spyOn(animalsDomain, 'searchAnimals').mockResolvedValue([
      inCareDog,
      transferredCat,
    ])

    render(
      <MemoryRouter>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('img', { name: 'Photo card for In Care Dog' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Photo card for Transferred Cat' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 in care at Test Shelter')).toBeInTheDocument()

    const countQuery = queries.find((query) => /count\(/i.test(query.sql))
    expect(countQuery?.sql).toMatch(/counts_as_in_care\s*=\s*1/i)
    expect(countQuery?.sql).toMatch(/animal_statuses/i)
    expect(countQuery?.params).toEqual(['org-1'])
  })

  it('keeps a filtered transferred animal in the list as a match, not an in-care total', async () => {
    vi.spyOn(animalsDomain, 'searchAnimals').mockResolvedValue([transferredCat])

    render(
      <MemoryRouter initialEntries={['/animals?status=st-transferred']}>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('img', { name: 'Photo card for Transferred Cat' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 match')).toBeInTheDocument()
    expect(screen.queryByText(/in care at/i)).not.toBeInTheDocument()
  })
})
