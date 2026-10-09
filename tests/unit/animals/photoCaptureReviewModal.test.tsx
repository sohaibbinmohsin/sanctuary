import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PhotoCapture } from '@/features/animals/components/PhotoCapture'
import * as photosDomain from '@/features/photos/domain/photos'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    execute: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    getOptional: vi.fn().mockResolvedValue(null),
  }),
}))

vi.mock('@/features/playground/mode', () => ({
  isPlaygroundMode: () => true,
}))

vi.mock('@/shared/hooks/useCanTakePhoto', () => ({
  useCanTakePhoto: () => true,
}))

describe('PhotoCapture Option 1 Custom Review Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(photosDomain, 'countPendingPhotos').mockResolvedValue(0)
    vi.spyOn(photosDomain, 'queuePhoto').mockResolvedValue({ id: 'photo-1' } as any)
    // Mock URL.createObjectURL and URL.revokeObjectURL
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-preview-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  it('opens native camera input and shows custom review modal on photo capture', async () => {
    const onQueued = vi.fn()
    const { container } = render(
      <PhotoCapture
        orgId="org-1"
        animalId="anim-1"
        shelterCode="MS-0001"
        animalName="Barnaby"
        onQueued={onQueued}
      />
    )

    // Initially no modal
    expect(screen.queryByText('Photo captured')).not.toBeInTheDocument()

    // Find the camera input
    const inputs = container.querySelectorAll('input[type="file"]')
    const cameraInput = Array.from(inputs).find(
      (inp) => inp.getAttribute('capture') === 'environment'
    ) as HTMLInputElement
    expect(cameraInput).toBeInTheDocument()

    // Simulate capturing a photo from native camera
    const file = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(cameraInput, { target: { files: [file] } })

    // Custom review modal should appear
    expect(await screen.findByText('Photo captured')).toBeInTheDocument()
    expect(screen.getByText('MS-0001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    // Verify it DOES NOT show field intake buttons
    expect(screen.queryByText('Add details later')).not.toBeInTheDocument()
    expect(screen.queryByText('Add details now')).not.toBeInTheDocument()
    expect(screen.queryByText('Add details now →')).not.toBeInTheDocument()

    // Click "Save photo"
    fireEvent.click(screen.getByRole('button', { name: 'Save photo' }))

    await waitFor(() => {
      expect(photosDomain.queuePhoto).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orgId: 'org-1',
          animalId: 'anim-1',
          captureSource: 'camera',
        })
      )
    })

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText('Photo captured')).not.toBeInTheDocument()
    })
  })

  it('allows retaking photo and cancels cleanly', async () => {
    const { container } = render(
      <PhotoCapture
        orgId="org-1"
        animalId="anim-1"
        shelterCode="MS-0001"
        animalName="Barnaby"
      />
    )

    const inputs = container.querySelectorAll('input[type="file"]')
    const cameraInput = Array.from(inputs).find(
      (inp) => inp.getAttribute('capture') === 'environment'
    ) as HTMLInputElement

    const clickSpy = vi.spyOn(cameraInput, 'click')

    // Simulate photo snap
    const file = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(cameraInput, { target: { files: [file] } })

    expect(await screen.findByText('Photo captured')).toBeInTheDocument()

    // Click "Retake photo"
    fireEvent.click(screen.getByRole('button', { name: 'Retake photo' }))

    // Should have re-triggered camera input click
    expect(clickSpy).toHaveBeenCalled()

    // And review modal is dismissed
    expect(screen.queryByText('Photo captured')).not.toBeInTheDocument()
  })

  it('dismisses modal on Cancel without saving', async () => {
    const { container } = render(
      <PhotoCapture
        orgId="org-1"
        animalId="anim-1"
        shelterCode="MS-0001"
        animalName="Barnaby"
      />
    )

    const inputs = container.querySelectorAll('input[type="file"]')
    const cameraInput = Array.from(inputs).find(
      (inp) => inp.getAttribute('capture') === 'environment'
    ) as HTMLInputElement

    const file = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(cameraInput, { target: { files: [file] } })

    expect(await screen.findByText('Photo captured')).toBeInTheDocument()

    // Click "Cancel"
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Modal dismissed, queuePhoto was never called
    expect(screen.queryByText('Photo captured')).not.toBeInTheDocument()
    expect(photosDomain.queuePhoto).not.toHaveBeenCalled()
  })

  it('in mobile mode: bypasses review sheet and saves photo immediately on capture', async () => {
    const isMobileModule = await import('@/shared/hooks/useIsMobile')
    vi.spyOn(isMobileModule, 'useIsMobile').mockReturnValue(true)

    const onQueued = vi.fn()
    const { container } = render(
      <PhotoCapture
        orgId="org-1"
        animalId="anim-1"
        shelterCode="MS-0001"
        animalName="Barnaby"
        onQueued={onQueued}
      />
    )

    const inputs = container.querySelectorAll('input[type="file"]')
    const cameraInput = Array.from(inputs).find(
      (inp) => inp.getAttribute('capture') === 'environment'
    ) as HTMLInputElement

    const file = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(cameraInput, { target: { files: [file] } })

    // On mobile, review modal should NOT appear
    expect(screen.queryByText('Photo captured')).not.toBeInTheDocument()

    // queuePhoto should be called directly
    await waitFor(() => {
      expect(photosDomain.queuePhoto).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          animalId: 'anim-1',
          blob: file,
          captureSource: 'camera',
        })
      )
    })
  })
})
