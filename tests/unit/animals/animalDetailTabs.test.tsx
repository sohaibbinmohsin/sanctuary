import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockGetAll = vi.fn()

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    }),
    getAll: mockGetAll,
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('Care and Timeline tabs on AnimalDetailScreen', () => {
  beforeEach(() => {
    if (typeof globalThis.caches === 'undefined') {
      vi.stubGlobal('caches', {
        open: vi.fn().mockResolvedValue({
          match: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(false),
          keys: vi.fn().mockResolvedValue([]),
        }),
      })
    }
  })

  it('switches between Care tab and Timeline tab, showing respective entries', async () => {
    mockGetAll.mockResolvedValue([
      { id: 'tr-1', animal_id: 'anim-1', treatment_type: 'medication', notes: 'Given antibiotic', treated_at: '2026-10-05T10:00:00Z' },
      { id: 'tr-2', animal_id: 'anim-1', treatment_type: 'status', notes: 'Moved to foster', treated_at: '2026-10-05T09:00:00Z' },
    ])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const careTab = await screen.findByRole('tab', { name: /Care/i })
    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    expect(careTab).toBeInTheDocument()
    expect(timelineTab).toBeInTheDocument()

    // Verify aria-selected and active classes
    expect(careTab).toHaveAttribute('aria-selected', 'true')
    expect(careTab).toHaveClass('is-active')
    expect(timelineTab).toHaveAttribute('aria-selected', 'false')

    // Default Care tab: shows medication note and Log care button
    expect(screen.getByText('Given antibiotic')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Log care/i })).toBeInTheDocument()
    expect(screen.queryByText('Moved to foster')).toBeNull()

    // Switch to Timeline tab: shows status change and arrival milestone
    fireEvent.click(timelineTab)
    expect(timelineTab).toHaveAttribute('aria-selected', 'true')
    expect(timelineTab).toHaveClass('is-active')
    expect(careTab).toHaveAttribute('aria-selected', 'false')

    expect(screen.getByText('Moved to foster')).toBeInTheDocument()
    expect(screen.getByText('Arrived')).toBeInTheDocument()
    expect(screen.queryByText('Given antibiotic')).toBeNull()
  })

  it('renders empty state in Care tab when no care notes exist', async () => {
    mockGetAll.mockResolvedValue([
      { id: 'tr-2', animal_id: 'anim-1', treatment_type: 'status', notes: 'Moved to foster', treated_at: '2026-10-05T09:00:00Z' },
    ])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const careTab = await screen.findByRole('tab', { name: /Care/i })
    expect(careTab).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 2, name: 'Care log' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Log care/i })).toBeInTheDocument()
    expect(
      screen.getByText('No care notes yet. Tap Log care to add the first one.')
    ).toBeInTheDocument()
  })
})


