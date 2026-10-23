import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicReportStepLocation } from '@/features/reports/components/public/PublicReportStepLocation'
import { INITIAL_DRAFT } from '@/features/reports/hooks/useReportDraft'
import { requestCurrentPosition } from '@/features/reports/domain/coordinates'

vi.mock('@/features/reports/domain/coordinates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/reports/domain/coordinates')>()
  return {
    ...actual,
    requestCurrentPosition: vi.fn(),
  }
})

describe('PublicReportStepLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders city selector and area input', () => {
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
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Area/i)).toBeInTheDocument()
    expect(screen.getByText(/Share exact GPS location/i)).toBeInTheDocument()
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

  it('enables continue button when area is entered', () => {
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

    const gpsBtn = screen.getByRole('button', { name: /Share exact GPS location/i })
    fireEvent.click(gpsBtn)

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        latitude: 31.5204,
        longitude: 74.3587,
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

    const gpsBtn = screen.getByRole('button', { name: /Share exact GPS location/i })
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

    expect(screen.getByText(/GPS captured \(31.5204, 74.3587\)/i)).toBeInTheDocument()
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
