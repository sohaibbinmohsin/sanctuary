import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'
import * as animalsDomain from '@/features/animals/domain/animals'
import * as photosDomain from '@/features/photos/domain/photos'

const mockConfirm = vi.fn().mockResolvedValue(true)
vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => mockConfirm,
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: vi.fn(),
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

describe('AnimalDetailScreen Rescue Card and Edit Modal Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(animalsDomain, 'getAnimal').mockResolvedValue({
      id: 'anim-rescue',
      org_id: 'org-1',
      shelter_code: 'MS-0006',
      name: null,
      species: 'Unknown',
      intake_date: '2026-10-06',
      status_id: 'st-intake',
      status_label: 'Intake',
      sex: null,
      markings: null,
      notes: null,
      life_stage: null,
      archived: 0,
      created_at: '2026-10-06T00:00:00Z',
      updated_at: '2026-10-06T00:00:00Z',
    } as unknown as animalsDomain.AnimalWithStatus)
    vi.spyOn(animalsDomain, 'archiveAnimal').mockResolvedValue(undefined)
    vi.spyOn(photosDomain, 'deletePhotosForAnimal').mockResolvedValue(undefined)
  })

  it('opens edit modal when clicking rescue details card Add button and renders remove animal button', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/animals/anim-rescue']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
          <Route path="/animals" element={<div>Animals List</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Wait for rescue details card
    expect(await screen.findByText('Rescue details needed')).toBeInTheDocument()

    // Edit modal should be closed initially
    expect(screen.queryByRole('heading', { name: 'Edit details' })).not.toBeInTheDocument()

    // Click the "Add →" button on the rescue details card
    const addBtn = container.querySelector('.stub-callout__btn') as HTMLButtonElement
    expect(addBtn).toBeInTheDocument()
    fireEvent.click(addBtn)

    // Edit details sheet modal should now be open
    expect(await screen.findByRole('heading', { name: 'Edit details' })).toBeInTheDocument()

    // Name field should be editable
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()

    // Remove animal button should be present at the bottom of the modal
    const removeBtn = screen.getByRole('button', { name: /remove animal/i })
    expect(removeBtn).toBeInTheDocument()

    // Click Remove animal
    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('MS-0006'),
          confirmLabel: 'Remove animal',
          tone: 'danger',
        })
      )
      expect(animalsDomain.archiveAnimal).toHaveBeenCalledWith(expect.anything(), 'anim-rescue')
      expect(photosDomain.deletePhotosForAnimal).toHaveBeenCalledWith(expect.anything(), 'anim-rescue')
    })
  })

  it('renders Intake status badge on timeline instead of Arrived', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-rescue']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText('Rescue details needed')

    // On timeline, the intake status tag should show Intake, NOT Arrived
    expect(screen.getByText('Intake')).toBeInTheDocument()
    expect(screen.queryByText('Arrived')).not.toBeInTheDocument()
  })
})
