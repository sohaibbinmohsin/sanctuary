import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockExecute = vi.fn().mockResolvedValue(undefined)
const mockGetAll = vi.fn().mockResolvedValue([])
let currentAnimal: Record<string, unknown>

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockImplementation(async () => currentAnimal),
    getAll: mockGetAll,
    execute: mockExecute,
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'AWS', orgName: 'Animal Welfare Society LUMS', role: 'admin', userId: 'user-1' },
    loading: false,
  }),
}))

function renderDetail() {
  render(
    <MemoryRouter initialEntries={['/animals/anim-1']}>
      <Routes>
        <Route path="/animals/:id" element={<AnimalDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Animal detail age row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentAnimal = {
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'AWS-0001',
      name: 'Mona',
      species: 'Cat',
      life_stage: 'adult',
      sex: 'Female',
      markings: null,
      age_years: null,
      age_months: null,
      intake_date: '2026-11-20',
      status_id: 'st-1',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-11-20T00:00:00Z',
      updated_at: '2026-11-20T00:00:00Z',
    }
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

  it('shows age beside species and saves it from Edit details', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('tab', { name: /Details/i }))

    const grid = document.querySelector('.characteristics-grid')
    expect(grid).toBeTruthy()
    const species = within(grid as HTMLElement).getByText('Species & Life Stage')
    const age = within(grid as HTMLElement).getByText('Age')
    const sex = within(grid as HTMLElement).getByText('Sex')
    const sterilized = within(grid as HTMLElement).getByText('Sterilized')
    expect(species.compareDocumentPosition(age) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sex.compareDocumentPosition(sterilized) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(species.closest('.characteristic-item')).toHaveClass('characteristic-item--stack')
    expect(age.closest('.characteristic-item')).toHaveClass('characteristic-item--stack')
    expect(species.closest('.characteristic-item')).not.toHaveClass('characteristic-item--full')
    expect(age.closest('.characteristic-item')).not.toHaveClass('characteristic-item--full')
    expect(sex.closest('.characteristic-item')).not.toHaveClass('characteristic-item--full')
    expect(sex.closest('.characteristic-item')).not.toHaveClass('characteristic-item--stack')
    expect(sterilized.closest('.characteristic-item')).not.toHaveClass('characteristic-item--full')
    expect(sterilized.closest('.characteristic-item')).not.toHaveClass('characteristic-item--stack')
    expect(age.closest('.characteristic-item')).toHaveTextContent('Unknown')
    expect(within(grid as HTMLElement).queryByRole('button', { name: /age/i })).toBeNull()
    expect(screen.getByText(/Cat · Adult/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const editDialog = screen.getByRole('dialog')
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Age, unknown' }))

    const years = screen.getByRole('listbox', { name: 'Years' })
    const months = screen.getByRole('listbox', { name: 'Months' })
    expect(screen.getByText('Years').compareDocumentPosition(screen.getByText('Months')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(within(years).getByRole('option', { name: '2' }))
    fireEvent.click(within(months).getByRole('option', { name: '6' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(mockExecute).not.toHaveBeenCalledWith(
      expect.stringContaining('age_years'),
      expect.anything(),
    )
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('age_years'),
        [2, 6, expect.any(String), 'anim-1'],
      )
    })
  })

  it('discards the wheels when Cancel is pressed', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('tab', { name: /Details/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Age, unknown' }))
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Years' })).getByRole('option', { name: '5' }))
    const ageDialog = screen.getByRole('heading', { name: 'Age' }).closest('[role="dialog"]') as HTMLElement
    fireEvent.click(within(ageDialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'Edit details' })).toBeInTheDocument()
    expect(mockExecute).not.toHaveBeenCalledWith(
      expect.stringContaining('age_years'),
      expect.anything(),
    )
  })
})