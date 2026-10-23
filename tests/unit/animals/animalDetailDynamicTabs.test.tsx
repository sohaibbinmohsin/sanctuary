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

describe('AnimalDetailScreen Dynamic Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('renders Timeline first when care notes are empty', async () => {
    // When no care history exists, Timeline is tab 1, Care is tab 2, Details is tab 3
    mockGetAll.mockResolvedValue([
      {
        id: 'tr-st-1',
        animal_id: 'anim-1',
        treatment_type: 'status',
        notes: 'Intake completed',
        treated_at: '2026-10-05T09:00:00Z',
      },
    ])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const tabs = await screen.findAllByRole('tab')
    expect(tabs).toHaveLength(3)

    // Check tab order
    expect(tabs[0]).toHaveTextContent('Timeline')
    expect(tabs[1]).toHaveTextContent('Care')
    expect(tabs[2]).toHaveTextContent('Details')

    // Timeline should be active by default
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveClass('is-active')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')

    // Status timeline content rendered by default
    expect(screen.getByRole('heading', { level: 2, name: 'Status timeline' })).toBeInTheDocument()
  })

  it('renders Care first when care notes exist', async () => {
    // When care history exists, Care is tab 1, Timeline is tab 2, Details is tab 3
    mockGetAll.mockResolvedValue([
      {
        id: 'tr-care-1',
        animal_id: 'anim-1',
        treatment_type: 'meds',
        notes: 'Given antibiotics',
        treated_at: '2026-10-05T10:00:00Z',
      },
      {
        id: 'tr-st-1',
        animal_id: 'anim-1',
        treatment_type: 'status',
        notes: 'Intake completed',
        treated_at: '2026-10-05T09:00:00Z',
      },
    ])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const tabs = await screen.findAllByRole('tab')
    expect(tabs).toHaveLength(3)

    // Check tab order
    expect(tabs[0]).toHaveTextContent('Care')
    expect(tabs[1]).toHaveTextContent('Timeline')
    expect(tabs[2]).toHaveTextContent('Details')

    // Care should be active by default
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveClass('is-active')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')

    // Care History content rendered by default
    expect(screen.getByRole('heading', { level: 2, name: 'Care History' })).toBeInTheDocument()
  })

  it('renders Details tab placeholder panel when selected', async () => {
    mockGetAll.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    expect(detailsTab).toBeInTheDocument()

    fireEvent.click(detailsTab)

    expect(detailsTab).toHaveAttribute('aria-selected', 'true')
    expect(detailsTab).toHaveClass('is-active')

    // Placeholder panel with heading "Animal Details"
    const detailsPanel = screen.getByRole('tabpanel')
    expect(detailsPanel).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Animal Details' })).toBeInTheDocument()
  })

  it('respects manual user tab selection across clicks', async () => {
    mockGetAll.mockResolvedValue([
      {
        id: 'tr-care-1',
        animal_id: 'anim-1',
        treatment_type: 'meds',
        notes: 'Given antibiotics',
        treated_at: '2026-10-05T10:00:00Z',
      },
    ])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const careTab = await screen.findByRole('tab', { name: /^Care$/i })
    const timelineTab = await screen.findByRole('tab', { name: /^Timeline$/i })
    const detailsTab = await screen.findByRole('tab', { name: /^Details$/i })

    // Care is initially active
    expect(careTab).toHaveAttribute('aria-selected', 'true')

    // Click Timeline
    fireEvent.click(timelineTab)
    expect(timelineTab).toHaveAttribute('aria-selected', 'true')
    expect(careTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { level: 2, name: 'Status timeline' })).toBeInTheDocument()

    // Click Details
    fireEvent.click(detailsTab)
    expect(detailsTab).toHaveAttribute('aria-selected', 'true')
    expect(timelineTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { level: 2, name: 'Animal Details' })).toBeInTheDocument()

    // Click back to Care
    fireEvent.click(careTab)
    expect(careTab).toHaveAttribute('aria-selected', 'true')
    expect(detailsTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { level: 2, name: 'Care History' })).toBeInTheDocument()
  })
})
