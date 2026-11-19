import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockExecute = vi.fn().mockResolvedValue(undefined)

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
    getAll: vi.fn().mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM treatments')) {
        return [
          {
            id: 'care-1',
            animal_id: 'anim-1',
            org_id: 'org-1',
            treatment_type: 'vaccination',
            vaccine: 'rabies',
            notes: null,
            treated_at: '2026-11-20T12:00:00.000Z',
            hide_from_public: 0,
            created_at: '2026-11-20T12:00:00.000Z',
          },
        ]
      }
      return []
    }),
    execute: mockExecute,
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin', userId: 'user-1' },
    loading: false,
  }),
}))

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

describe('Vaccination care log', () => {
  it('shows the vaccine on the care list', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('tab', { name: /Care/i }))
    expect(await screen.findByText('Vaccination · Rabies')).toBeInTheDocument()
  })

  it('saves one vaccine without a note', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('tab', { name: /Care/i }))
    fireEvent.click(screen.getByRole('button', { name: /Log care/i }))

    fireEvent.click(screen.getByRole('button', { name: /What kind of care/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Vaccination' }))
    expect(screen.getByRole('button', { name: 'Vaccine' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vaccine' }))
    fireEvent.click(screen.getByRole('option', { name: 'Calci/FPV' }))

    const save = screen.getByRole('button', { name: 'Save care note' })
    expect(save).toBeEnabled()
    fireEvent.click(save)

    await waitFor(() => {
      const insert = mockExecute.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO treatments'))
      expect(insert?.[1]).toContain('vaccination')
      expect(insert?.[1]).toContain('calci_fpv')
    })
  })
})