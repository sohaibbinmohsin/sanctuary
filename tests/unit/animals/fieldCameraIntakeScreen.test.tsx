import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FieldCameraIntakeScreen } from '@/features/animals/screens/FieldCameraIntakeScreen'
import * as animalsDomain from '@/features/animals/domain/animals'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    getOptional: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'TS', orgName: 'Test Shelter' },
    loading: false,
  }),
}))

vi.mock('@/shared/lib/r2/captureSession', () => ({
  requestCaptureSession: vi.fn().mockResolvedValue({
    sessionId: 'sess-123',
    token: 'tok-123',
    expiresAt: '2026-10-03T01:00:00Z',
  }),
}))

vi.mock('@/features/photos/domain/photos', () => ({
  processPhotoQueue: vi.fn().mockResolvedValue({ uploaded: 1, failed: 0 }),
  rememberCaptureToken: vi.fn(),
  listPhotosForAnimal: vi.fn().mockResolvedValue([{ id: 'photo-1' }]),
}))

describe('FieldCameraIntakeScreen', () => {
  let originalMediaDevices: PropertyDescriptor | undefined
  let stopTrackMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    stopTrackMock = vi.fn()
    const mockStream = {
      getTracks: () => [{ stop: stopTrackMock }],
    }

    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    })

    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    }) as any
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['fake-captured-photo'], { type: 'image/jpeg' }))
    })

    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/preview-123')
    global.URL.revokeObjectURL = vi.fn()

    vi.spyOn(animalsDomain, 'getNextShelterCode').mockResolvedValue('TS-015')
    vi.spyOn(animalsDomain, 'createQuickAnimalStub').mockResolvedValue({
      animal: {
        id: 'new-animal-123',
        org_id: 'org-1',
        shelter_code: 'TS-015',
        species: 'Unknown',
        archived: 0,
        intake_date: '2026-10-03',
        status_id: 'st-1',
        created_at: '2026-10-03T00:00:00Z',
        updated_at: '2026-10-03T00:00:00Z',
      },
      shelterCode: 'TS-015',
    })
  })

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    }
  })

  it('renders camera controls, close button, and skip to form button', async () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /close camera/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip to form/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /take verified photo/i })).toBeInTheDocument()
  })

  it('navigates to /animals/new when clicking Skip to form', () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /skip to form/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/animals/new')
  })

  it('navigates to /animals when clicking Close button', () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /close camera/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/animals')
  })

  it('taking photo shows confirm card with Photo captured, image preview, shelter code, verified badge, and action buttons', async () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take verified photo/i })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /take verified photo/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText('Photo captured')).toBeInTheDocument()
    expect(screen.getByText('TS-015')).toBeInTheDocument()
    expect(screen.getByText(/verified photo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add details later/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add details now/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retake photo/i })).toBeInTheDocument()
  })

  it('clicking "Add details later" calls createQuickAnimalStub and displays toast', async () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take verified photo/i })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /take verified photo/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add details later/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add details later/i }))

    await waitFor(() => {
      expect(animalsDomain.createQuickAnimalStub).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orgId: 'org-1',
          prefix: 'TS',
          captureSource: 'camera',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/TS-015 saved · Ready for next animal/i)).toBeInTheDocument()
    })
  })

  it('clicking "Add details now →" calls createQuickAnimalStub and navigates to /animals/:id/edit', async () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take verified photo/i })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /take verified photo/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add details now/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add details now/i }))

    await waitFor(() => {
      expect(animalsDomain.createQuickAnimalStub).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orgId: 'org-1',
          prefix: 'TS',
          captureSource: 'camera',
        }),
      )
      expect(mockNavigate).toHaveBeenCalledWith('/animals/new-animal-123/edit')
    })
  })

  it('clicking "Retake photo" clears capture state and hides confirm card', async () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take verified photo/i })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /take verified photo/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retake photo/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /retake photo/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
