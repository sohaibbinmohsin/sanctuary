import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import * as animalsDomain from '@/features/animals/domain/animals'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'TS', orgName: 'Test' },
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
  useQuery: () => ({ data: [{ n: 1 }] }),
}))

describe('AnimalsListScreen Add Animal button integration', () => {
  it('renders AddAnimalSplitButton in page header actions when animals exist', async () => {
    vi.spyOn(animalsDomain, 'searchAnimals').mockResolvedValue([
      {
        id: 'anim-1',
        org_id: 'org-1',
        shelter_code: 'TS-0001',
        name: 'Barnaby',
        species: 'Dog',
        intake_date: '2026-10-01',
        status_id: 'st-1',
        status_label: 'Intake',
        sex: 'Male',
        markings: null,
        notes: null,
        life_stage: 'adult',
        archived: 0,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      } as animalsDomain.AnimalWithStatus,
    ])

    render(
      <MemoryRouter>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    const addBtn = await screen.findByRole('button', { name: /^Add animal$/i })
    expect(addBtn).toBeInTheDocument()

    const toggleBtn = screen.getByRole('button', { name: /Add animal options/i })
    expect(toggleBtn).toBeInTheDocument()
  })

  it('renders EmptyState linking to /animals/new when no animals exist', async () => {
    vi.spyOn(animalsDomain, 'searchAnimals').mockResolvedValue([])

    render(
      <MemoryRouter>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    const addLink = await screen.findByRole('link', { name: /^Add animal$/i })
    expect(addLink).toHaveAttribute('href', '/animals/new')
  })
})
