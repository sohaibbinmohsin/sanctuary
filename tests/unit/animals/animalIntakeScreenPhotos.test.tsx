import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AnimalIntakeScreen } from '@/features/animals/screens/AnimalIntakeScreen'
import * as animalsDomain from '@/features/animals/domain/animals'
import * as photosDomain from '@/features/photos/domain/photos'
import * as statusesDomain from '@/features/statuses/domain/statuses'
import * as currentMemberHook from '@/shared/hooks/useCurrentMember'
import * as dbHook from '@/shared/hooks/useDb'
import {
  stageIntakePhotos,
  clearPendingIntakePhotos,
} from '@/features/animals/domain/intakePhotoStore'

vi.mock('@/features/animals/domain/animals', () => ({
  createAnimal: vi.fn(),
  getAnimal: vi.fn(),
  updateAnimal: vi.fn(),
  archiveAnimal: vi.fn(),
}))

vi.mock('@/features/photos/domain/photos', () => ({
  queuePhoto: vi.fn(),
  processPhotoQueue: vi.fn(),
  deletePhotosForAnimal: vi.fn(),
}))

vi.mock('@/features/statuses/domain/statuses', () => ({
  listStatuses: vi.fn(),
}))

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(true)),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: vi.fn(),
}))

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: vi.fn(),
}))

vi.mock('@/shared/hooks/useCanTakePhoto', () => ({
  useCanTakePhoto: vi.fn(() => false),
}))

describe('AnimalIntakeScreen with Photos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    vi.spyOn(dbHook, 'useDb').mockReturnValue({} as any)
    vi.spyOn(currentMemberHook, 'useCurrentMember').mockReturnValue({
      member: {
        id: 'member-1',
        orgId: 'org-test',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Test Org',
        orgInitials: 'TO',
        orgCurrency: 'USD',
        setupCompleted: true,
      },
      loading: false,
    } as any)

    vi.spyOn(statusesDomain, 'listStatuses').mockResolvedValue([
      {
        id: 'status-1',
        org_id: 'org-test',
        label: 'Intake',
        sort_order: 1,
        counts_as_in_care: 1,
      },
    ] as any)
  })

  it('renders Photos section and queues staged photos on animal creation', async () => {
    const mockAnimal = {
      id: 'animal-new-123',
      shelter_code: 'TO-1',
      org_id: 'org-test',
      species: 'Dog',
      status_id: 'status-1',
      name: 'Buddy',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      intake_date: '2026-10-02',
      archived: 0,
    }
    vi.spyOn(animalsDomain, 'createAnimal').mockResolvedValue(mockAnimal as any)
    vi.spyOn(photosDomain, 'queuePhoto').mockResolvedValue({} as any)

    const { container } = render(
      <MemoryRouter initialEntries={['/animals/new']}>
        <AnimalIntakeScreen />
      </MemoryRouter>,
    )

    // Verify Photos panel is rendered
    expect(screen.getByText('Photos')).toBeInTheDocument()

    // Add a photo via file input
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const mockFile = new File(['image-content'], 'dog.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    // Verify preview thumbnail and remove button appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument()
    })

    // Fill in Name
    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'Buddy' } })

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /save animal/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(animalsDomain.createAnimal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orgId: 'org-test',
          name: 'Buddy',
          species: 'Dog',
        }),
      )
    })

    // Verify photo was queued with the new animalId and verified: false for gallery
    expect(photosDomain.queuePhoto).toHaveBeenCalledTimes(1)
    expect(photosDomain.queuePhoto).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-test',
        animalId: 'animal-new-123',
        captureSource: 'gallery',
        verified: false,
      }),
    )
  })

  it('stages multiple photos from intakePhotoStore on mount and queues all photos on save', async () => {
    clearPendingIntakePhotos()
    const file1 = new File(['file-1'], 'photo1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['file-2'], 'photo2.jpg', { type: 'image/jpeg' })
    stageIntakePhotos([file1, file2], 'camera')

    const mockAnimal = {
      id: 'animal-multi-photo',
      shelter_code: 'TO-2',
      org_id: 'org-test',
      species: 'Dog',
      status_id: 'status-1',
      name: 'Luna',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      intake_date: '2026-10-08',
      archived: 0,
    }
    vi.spyOn(animalsDomain, 'createAnimal').mockResolvedValue(mockAnimal as any)
    vi.spyOn(photosDomain, 'queuePhoto').mockResolvedValue({} as any)

    render(
      <MemoryRouter initialEntries={['/animals/new']}>
        <AnimalIntakeScreen />
      </MemoryRouter>,
    )

    // Verify 2 remove buttons for the 2 staged photos
    const removeButtons = screen.getAllByRole('button', { name: 'Remove photo' })
    expect(removeButtons).toHaveLength(2)

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /save animal/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(animalsDomain.createAnimal).toHaveBeenCalled()
    })

    // Both photos should be queued with verified: true for camera captures
    expect(photosDomain.queuePhoto).toHaveBeenCalledTimes(2)
    expect(photosDomain.queuePhoto).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        animalId: 'animal-multi-photo',
        captureSource: 'camera',
        verified: true,
      }),
    )
  })

  it('supports selecting Life stage (adult vs child) and passes to createAnimal', async () => {
    clearPendingIntakePhotos()
    const mockAnimal = {
      id: 'animal-child-1',
      shelter_code: 'TO-3',
      org_id: 'org-test',
      species: 'Cat',
      life_stage: 'child',
      status_id: 'status-1',
      name: 'Kitten Mew',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      intake_date: '2026-10-08',
      archived: 0,
    }
    vi.spyOn(animalsDomain, 'createAnimal').mockResolvedValue(mockAnimal as any)

    render(
      <MemoryRouter initialEntries={['/animals/new']}>
        <AnimalIntakeScreen />
      </MemoryRouter>,
    )

    // Select Cat
    fireEvent.click(screen.getByRole('button', { name: 'Cat' }))

    // Check Life stage segmented control
    const adultBtn = screen.getByRole('button', { name: 'Adult' })
    const childBtn = screen.getByRole('button', { name: 'Child' })
    expect(adultBtn).toHaveAttribute('aria-pressed', 'true')
    expect(childBtn).toHaveAttribute('aria-pressed', 'false')

    // Click Child
    fireEvent.click(childBtn)
    expect(childBtn).toHaveAttribute('aria-pressed', 'true')
    expect(adultBtn).toHaveAttribute('aria-pressed', 'false')

    // Fill name
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Kitten Mew' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save animal/i }))

    await waitFor(() => {
      expect(animalsDomain.createAnimal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          species: 'Cat',
          life_stage: 'child',
          name: 'Kitten Mew',
        }),
      )
    })
  })

  it('loads life_stage in edit mode and preserves or updates it', async () => {
    const existingAnimal = {
      id: 'animal-edit-1',
      shelter_code: 'TO-4',
      org_id: 'org-test',
      species: 'Dog',
      life_stage: 'child',
      sex: 'Female',
      markings: 'Spotted',
      status_id: 'status-1',
      name: 'Puppy Spot',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      intake_date: '2026-10-08',
      archived: 0,
    }
    vi.spyOn(animalsDomain, 'getAnimal').mockResolvedValue(existingAnimal as any)
    vi.spyOn(animalsDomain, 'updateAnimal').mockResolvedValue({} as any)

    render(
      <MemoryRouter initialEntries={['/animals/animal-edit-1/edit']}>
        <Routes>
          <Route path="/animals/:id/edit" element={<AnimalIntakeScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    // Wait for animal data to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Child' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    // Switch to Adult
    fireEvent.click(screen.getByRole('button', { name: 'Adult' }))
    expect(screen.getByRole('button', { name: 'Adult' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(animalsDomain.updateAnimal).toHaveBeenCalledWith(
        expect.anything(),
        'animal-edit-1',
        expect.objectContaining({
          life_stage: 'adult',
          species: 'Dog',
        }),
      )
    })
  })
})
