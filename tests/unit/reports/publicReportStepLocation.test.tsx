import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicReportStepLocation } from '@/features/reports/components/public/PublicReportStepLocation'
import { INITIAL_DRAFT } from '@/features/reports/hooks/useReportDraft'
import { requestCurrentPosition } from '@/features/reports/domain/coordinates'
import { extractPhotoMetadata } from '@/features/reports/domain/exif'
import { classifyReportPhoto } from '@/features/reports/domain/visionClassifier'

vi.mock('@/features/reports/domain/coordinates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/reports/domain/coordinates')>()
  return {
    ...actual,
    requestCurrentPosition: vi.fn(),
  }
})

vi.mock('@/features/reports/domain/exif', () => ({
  extractPhotoMetadata: vi.fn(),
}))

vi.mock('@/features/reports/domain/visionClassifier', () => ({
  classifyReportPhoto: vi.fn(),
}))

describe('PublicReportStepLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(classifyReportPhoto).mockResolvedValue(null)
  })

  it('renders category options and location choice buttons, and reveals manual inputs when clicked', () => {
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByText(/Sick \/ Injured Animal/i)).toBeInTheDocument()
    expect(screen.getByText(/Animal Cruelty/i)).toBeInTheDocument()
    expect(screen.queryByText(/Dog Bite/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Missing Pet/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Use current location/i)).toBeInTheDocument()
    expect(screen.getByText(/Enter location manually/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Area/i)).toBeInTheDocument()
  })

  it('validates area before continuing', () => {
    const onNext = vi.fn()
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={onNext}
      />
    )
    const nextBtn = screen.getByRole('button', { name: /Continue to Contact/i })
    expect(nextBtn).toBeDisabled()
  })

  it('disables continue button if area is entered but no photos are attached', () => {
    const onNext = vi.fn()
    const draft = { ...INITIAL_DRAFT, locationArea: 'Gulberg III' }
    render(
      <PublicReportStepLocation
        draft={draft}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={onNext}
      />
    )
    const nextBtn = screen.getByRole('button', { name: /Continue to Contact/i })
    expect(nextBtn).toBeDisabled()
    expect(screen.getByText(/Please attach at least 1 photo to continue/i)).toBeInTheDocument()
  })

  it('enables continue button when area is entered and at least one photo is attached', () => {
    const onNext = vi.fn()
    const draft = { ...INITIAL_DRAFT, locationArea: 'Gulberg III' }
    const mockPhotos = [{ id: 'p1', url: 'blob:test-p1', blob: new Blob(['x']) }]
    render(
      <PublicReportStepLocation
        draft={draft}
        photos={mockPhotos}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={onNext}
      />
    )
    const nextBtn = screen.getByRole('button', { name: /Continue to Contact/i })
    expect(nextBtn).not.toBeDisabled()

    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('does not call onNext when submitted with whitespace area', () => {
    const onNext = vi.fn()
    const draft = { ...INITIAL_DRAFT, locationArea: '   ' }
    render(
      <PublicReportStepLocation
        draft={draft}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={onNext}
      />
    )
    const nextBtn = screen.getByRole('button', { name: /Continue to Contact/i })
    expect(nextBtn).toBeDisabled()
  })

  it('triggers onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={onBack}
        onNext={vi.fn()}
      />
    )
    const backBtn = screen.getByRole('button', { name: /Back/i })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('updates city when changed in select', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={onUpdate}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const select = screen.getByLabelText(/City/i)
    fireEvent.change(select, { target: { value: 'Karachi' } })
    expect(onUpdate).toHaveBeenCalledWith({ city: 'Karachi' })
  })

  it('updates area when changed in input', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={onUpdate}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const areaInput = screen.getByLabelText(/Area/i)
    fireEvent.change(areaInput, { target: { value: 'DHA Phase 5' } })
    expect(onUpdate).toHaveBeenCalledWith({ locationArea: 'DHA Phase 5' })
  })

  it('updates landmark when changed in input', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={onUpdate}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Enter location manually/i }))
    const landmarkInput = screen.getByLabelText(/Specific landmark/i)
    fireEvent.change(landmarkInput, { target: { value: 'Opposite hospital' } })
    expect(onUpdate).toHaveBeenCalledWith({ locationLandmark: 'Opposite hospital' })
  })

  it('captures GPS coordinates successfully and updates draft', async () => {
    const onUpdate = vi.fn()
    vi.mocked(requestCurrentPosition).mockResolvedValueOnce({
      latitude: 31.5204,
      longitude: 74.3587,
    })

    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={onUpdate}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const gpsBtn = screen.getByRole('button', { name: /Use current location/i })
    fireEvent.click(gpsBtn)

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        latitude: 31.5204,
        longitude: 74.3587,
        locationArea: 'Current location',
      })
    })
  })

  it('handles GPS errors and displays error message', async () => {
    vi.mocked(requestCurrentPosition).mockRejectedValueOnce(
      new Error('Location permission was denied. Please allow location access.')
    )

    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const gpsBtn = screen.getByRole('button', { name: /Use current location/i })
    fireEvent.click(gpsBtn)

    await waitFor(() => {
      expect(screen.getByText(/Location permission was denied/i)).toBeInTheDocument()
    })
  })

  it('displays GPS captured badge when latitude and longitude are present in draft', () => {
    const draft = {
      ...INITIAL_DRAFT,
      latitude: 31.5204,
      longitude: 74.3587,
      locationArea: 'Current location',
    }

    render(
      <PublicReportStepLocation
        draft={draft}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    expect(screen.getByText(/Location confirmed/i)).toBeInTheDocument()
  })

  it('allows adding photos via file input', () => {
    const onAddPhotos = vi.fn()
    const { container } = render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={onAddPhotos}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    const mockFile = new File(['fake-image'], 'rescue.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    expect(onAddPhotos).toHaveBeenCalledTimes(1)
    const addedPhotos = onAddPhotos.mock.calls[0][0]
    expect(addedPhotos).toHaveLength(1)
    expect(addedPhotos[0].blob).toBe(mockFile)
    expect(addedPhotos[0].url).toBeTruthy()
    expect(addedPhotos[0].id).toBeTruthy()
  })

  it('automatically extracts EXIF GPS coordinates when photo with GPS is uploaded', async () => {
    const onUpdate = vi.fn()
    vi.mocked(extractPhotoMetadata).mockResolvedValueOnce({
      latitude: 31.4700,
      longitude: 74.4100,
      capturedAt: '2026-11-01T12:00:00Z',
    })

    const { container } = render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={onUpdate}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const mockFileWithExif = new File(['fake-gps-image'], 'rescue-gps.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFileWithExif] } })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        latitude: 31.4700,
        longitude: 74.4100,
      })
    })
  })

  it('renders staged photo thumbnails and triggers onRemovePhoto when delete is clicked', () => {
    const onRemovePhoto = vi.fn()
    const mockPhotos = [
      { id: 'photo-1', url: 'blob:test-1', blob: new Blob(['1']) },
      { id: 'photo-2', url: 'blob:test-2', blob: new Blob(['2']) },
    ]

    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={mockPhotos}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={onRemovePhoto}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const removeButtons = screen.getAllByRole('button', { name: /Remove photo/i })
    expect(removeButtons).toHaveLength(2)

    fireEvent.click(removeButtons[0])
    expect(onRemovePhoto).toHaveBeenCalledWith('photo-1')
  })

  it('hides add photo button when 5 photos are already uploaded', () => {
    const mockPhotos = Array.from({ length: 5 }, (_, i) => ({
      id: `photo-${i + 1}`,
      url: `blob:test-${i + 1}`,
      blob: new Blob([`${i + 1}`]),
    }))

    render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={mockPhotos}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    expect(screen.queryByText(/Add photo/i)).not.toBeInTheDocument()
  })

  it('automatically triggers background image classification without blocking user', async () => {
    const onUpdate = vi.fn()
    vi.mocked(classifyReportPhoto).mockResolvedValueOnce({
      is_animal_present: true,
      species_primary: 'Dog',
      species_details: 'Mother dog with 3 puppies',
      composition: 'mother_and_offspring',
      animal_count: 4,
      condition_and_injuries: 'Injured left leg',
      environment_context: 'Street side',
    })

    const { container } = render(
      <PublicReportStepLocation
        draft={INITIAL_DRAFT}
        photos={[]}
        onUpdate={onUpdate}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const mockFile = new File(['dog-img'], 'dog.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    await waitFor(() => {
      expect(classifyReportPhoto).toHaveBeenCalledWith(mockFile)
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          speciesPreset: 'Dog',
          animalCount: 4,
          intakeCountMode: 'litter',
          chiefComplaint: 'Injured left leg',
        })
      )
    })
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <PublicReportStepLocation
        draft={{ ...INITIAL_DRAFT, locationArea: 'Gulberg' }}
        photos={[]}
        onUpdate={vi.fn()}
        onAddPhotos={vi.fn()}
        onRemovePhoto={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(container.textContent).not.toContain('\u2014')
    expect(container.textContent).not.toContain('--')
  })
})
