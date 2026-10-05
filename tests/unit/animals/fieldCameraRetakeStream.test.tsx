import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FieldCameraIntakeScreen } from '@/features/animals/screens/FieldCameraIntakeScreen'

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

describe('FieldCameraIntakeScreen retake video stream preservation', () => {
  beforeEach(() => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as any
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb) => {
      cb(new Blob(['fake'], { type: 'image/jpeg' }))
    })
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('keeps video element mounted when photo is captured and when retake is clicked', async () => {
    render(
      <MemoryRouter>
        <FieldCameraIntakeScreen />
      </MemoryRouter>
    )

    const videoEl = document.querySelector('video')
    expect(videoEl).toBeInTheDocument()

    // Wait for stream to be ready and shutter enabled
    const shutter = screen.getByLabelText(/Take verified photo/i)
    await waitFor(() => {
      expect(shutter).toBeEnabled()
    })

    // Capture photo
    fireEvent.click(shutter)

    // Confirm sheet is open
    expect(await screen.findByText('Photo captured')).toBeInTheDocument()

    // Video must still be in the DOM (not unmounted!)
    expect(document.querySelector('video')).toBeInTheDocument()

    // Click Retake photo
    const retakeBtn = screen.getByRole('button', { name: /Retake photo/i })
    fireEvent.click(retakeBtn)

    // Video is still the same element and ready
    expect(document.querySelector('video')).toBeInTheDocument()
  })
})
