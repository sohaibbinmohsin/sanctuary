import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalIntakeScreen } from '@/features/animals/screens/AnimalIntakeScreen'
import * as animalsDomain from '@/features/animals/domain/animals'
import * as photosDomain from '@/features/photos/domain/photos'
import * as statusesDomain from '@/features/statuses/domain/statuses'
import * as currentMemberHook from '@/shared/hooks/useCurrentMember'
import * as dbHook from '@/shared/hooks/useDb'

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

    // Verify photo was queued with the new animalId
    expect(photosDomain.queuePhoto).toHaveBeenCalledTimes(1)
    expect(photosDomain.queuePhoto).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-test',
        animalId: 'animal-new-123',
        captureSource: 'gallery',
      }),
    )
  })
})
