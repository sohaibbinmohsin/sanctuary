import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

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

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockResolvedValue({
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      intake_date: '2026-10-06',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-06T00:00:00Z',
      updated_at: '2026-10-06T00:00:00Z',
    }),
    getAll: vi.fn().mockResolvedValue([
      { id: 'tr-st-1', animal_id: 'anim-1', treatment_type: 'status', notes: 'Checked by vet', treated_at: '2026-10-06T14:00:00Z' },
    ]),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('Timeline UI with tags as primary', () => {
  it('renders status tag badge as primary element, timestamp as secondary, and optional notes', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    fireEvent.click(timelineTab)

    const timelineItem = screen.getByText('Checked by vet').closest('.timeline-item')
    expect(timelineItem).toBeInTheDocument()
    // Status badge is rendered inside timeline item
    expect(timelineItem?.querySelector('.status-badge')).toBeInTheDocument()
    expect(timelineItem?.querySelector('.timeline-item__timestamp')).toBeInTheDocument()
    expect(timelineItem?.querySelector('.timeline-item__notes')).toHaveTextContent('Checked by vet')
  })
})
