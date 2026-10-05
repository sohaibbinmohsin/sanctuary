import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockGetOptional = vi.fn()

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: mockGetOptional,
    getAll: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('Rescue details needed placement on AnimalDetailScreen', () => {
  it('renders Rescue details needed card below the animal title, not above it', async () => {
    mockGetOptional.mockResolvedValueOnce({
      id: 'stub-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: null,
      species: 'Unknown',
      sex: null,
      markings: null,
      notes: null,
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    })

    render(
      <MemoryRouter initialEntries={['/animals/stub-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const title = await screen.findByRole('heading', { level: 1, name: 'MS-0001' })
    const stubCard = await screen.findByText('Rescue details needed')

    // Document position check: title must precede stubCard in DOM
    expect(title.compareDocumentPosition(stubCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // "Unknown" text should not be rendered
    expect(screen.queryByText('Unknown')).toBeNull()
  })

  it('renders detailMeta and does not render Rescue details needed card when species is known', async () => {
    mockGetOptional.mockResolvedValueOnce({
      id: 'animal-2',
      org_id: 'org-1',
      shelter_code: 'MS-0002',
      name: 'Bella',
      species: 'Dog',
      sex: 'Female',
      markings: 'Brown spots',
      notes: null,
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    })

    render(
      <MemoryRouter initialEntries={['/animals/animal-2']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByRole('heading', { level: 1, name: 'Bella' })
    expect(screen.queryByText('Rescue details needed')).toBeNull()
    expect(screen.getByText('Dog · Female · Brown spots')).toBeDefined()
  })
})
