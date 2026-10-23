import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockGetAll = vi.fn()
const mockExecute = vi.fn().mockResolvedValue(undefined)
let currentAnimalData: any

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn().mockImplementation(async () => currentAnimalData),
    getAll: mockGetAll,
    execute: mockExecute,
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('AnimalDetailScreen Characteristics View & Edit Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentAnimalData = {
      id: 'anim-1',
      org_id: 'org-1',
      shelter_code: 'MS-0001',
      name: 'Barnaby',
      species: 'Dog',
      life_stage: 'adult',
      sex: 'Male',
      markings: 'White patch on chest',
      intake_date: '2026-10-05',
      status_id: 'st-intake',
      status_label: 'Intake',
      status_labels: ['Intake'],
      archived: 0,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    }
    mockGetAll.mockResolvedValue([])
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

  it('renders characteristics view under Details tab with Edit details button', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    expect(screen.getByRole('heading', { level: 2, name: 'Animal Details' })).toBeInTheDocument()

    // Edit details secondary button
    const editBtn = screen.getByRole('button', { name: /Edit details/i })
    expect(editBtn).toBeInTheDocument()

    // Characteristics displayed:
    const grid = document.querySelector('.characteristics-grid')
    expect(grid).toBeInTheDocument()

    // Species & Life Stage
    expect(grid).toHaveTextContent('Dog · Adult')
    // Sex
    expect(grid).toHaveTextContent('Male')
    // Markings
    expect(grid).toHaveTextContent('White patch on chest')
    // Shelter Code & Intake Date
    expect(grid).toHaveTextContent('MS-0001')
    expect(grid).toHaveTextContent('2026-10-05')
  })

  it('opens EditAnimalDetailsModal, updates fields, and saves via updateAnimal', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    const editBtn = screen.getByRole('button', { name: /Edit details/i })
    fireEvent.click(editBtn)

    // Modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Edit details/i })).toBeInTheDocument()

    // Species pills: Dog, Cat, Horse, Donkey, Bird, Other
    const catPill = screen.getByRole('button', { name: 'Cat' })
    fireEvent.click(catPill)

    // Life stage toggle: Adult vs Child
    const childToggle = screen.getByRole('button', { name: 'Child' })
    fireEvent.click(childToggle)

    // Sex selector: Female, Male, Unknown
    const femalePill = screen.getByRole('button', { name: 'Female' })
    fireEvent.click(femalePill)

    // Markings input/textarea
    const markingsInput = screen.getByLabelText(/Markings/i)
    fireEvent.change(markingsInput, { target: { value: 'Calico coat, brown ears' } })

    // Save button
    const saveBtn = screen.getByRole('button', { name: /^Save$/i })
    expect(saveBtn).toBeInTheDocument()
    fireEvent.click(saveBtn)

    // Verified updateAnimal / db.execute called with updated values
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE animals SET'),
        expect.arrayContaining([
          'Cat',
          'Female',
          'child',
          'Calico coat, brown ears',
          'anim-1',
        ]),
      )
    })
  })

  it('supports custom species when Other is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const detailsTab = await screen.findByRole('tab', { name: /Details/i })
    fireEvent.click(detailsTab)

    fireEvent.click(screen.getByRole('button', { name: /Edit details/i }))

    // Click "Other" species pill
    fireEvent.click(screen.getByRole('button', { name: 'Other' }))

    // Custom species text input appears
    const customSpeciesInput = screen.getByLabelText(/Specify species/i)
    fireEvent.change(customSpeciesInput, { target: { value: 'Alpaca' } })

    // Click save
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE animals SET'),
        expect.arrayContaining(['Alpaca']),
      )
    })
  })
})
