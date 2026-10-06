import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

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

describe('AnimalDetailScreen header alignment', () => {
  it('renders title-wrap and daily care button in aligned id-row', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const idRow = await screen.findByRole('heading', { level: 1, name: 'Barnaby' })
    const parentRow = idRow.closest('.detail-hero__id-row')
    expect(parentRow).toBeInTheDocument()
    expect(parentRow?.querySelector('.btn--inline-edit')).toBeInTheDocument()
    expect(parentRow?.querySelector('.animal-daily-care-btn')).toBeInTheDocument()
  })
})
