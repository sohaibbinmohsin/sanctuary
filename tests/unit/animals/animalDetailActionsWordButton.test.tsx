import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockAnimal = {
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
}

const mockGetOptional = vi.fn()
const mockGetAll = vi.fn().mockResolvedValue([])
const mockExecute = vi.fn().mockResolvedValue(undefined)

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: mockGetOptional,
    getAll: mockGetAll,
    execute: mockExecute,
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', userId: 'user-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('Inline edit and word-based Daily Care button', () => {
  it('renders inline edit pencil and "+ Daily Care" word button when not on checklist', async () => {
    mockGetOptional.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('checklist_items')) {
        return null
      }
      return mockAnimal
    })
    mockGetAll.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const editBtn = await screen.findByRole('link', { name: /Edit animal/i })
    expect(editBtn).toBeInTheDocument()

    const careBtn = await screen.findByRole('button', { name: /Add to Daily Care/i })
    expect(careBtn).toBeInTheDocument()
    expect(careBtn).toHaveTextContent('+ Daily Care')
  })

  it('renders "In Daily Care" when already on checklist and toggles when clicked', async () => {
    let inChecklist = true
    mockGetOptional.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('checklist_items')) {
        return inChecklist ? { animal_id: 'anim-1' } : null
      }
      return mockAnimal
    })
    mockExecute.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('DELETE FROM checklist_items')) {
        inChecklist = false
      }
    })
    mockGetAll.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const careBtn = await screen.findByRole('button', { name: /Remove from Daily Care/i })
    expect(careBtn).toBeInTheDocument()
    expect(careBtn).toHaveClass('is-active')
    expect(careBtn).toHaveTextContent('In Daily Care')

    await fireEvent.click(careBtn)

    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM checklist_items'),
      ['org-1', 'anim-1'],
    )

    const toggledBtn = await screen.findByRole('button', { name: /Add to Daily Care/i })
    expect(toggledBtn).toBeInTheDocument()
    expect(toggledBtn).toHaveTextContent('+ Daily Care')
  })
})
