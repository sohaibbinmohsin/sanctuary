import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  IntakePhotoPicker,
  type StagedPhoto,
} from '@/features/animals/components/IntakePhotoPicker'
import * as canTakeModule from '@/shared/hooks/useCanTakePhoto'

// Mock InAppCamera so it renders a simple test stub
vi.mock('@/features/animals/components/InAppCamera', () => ({
  InAppCamera: ({
    onCapture,
    onCancel,
  }: {
    onCapture: (blob: Blob) => void
    onCancel: () => void
  }) => (
    <div data-testid="in-app-camera">
      <button
        type="button"
        onClick={() => onCapture(new Blob(['photo'], { type: 'image/jpeg' }))}
      >
        Mock Shutter
      </button>
      <button type="button" onClick={onCancel}>
        Mock Cancel
      </button>
    </div>
  ),
}))

describe('IntakePhotoPicker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('in desktop mode, clicking add directly triggers file input without menu', () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(false)
    const onAddPhotos = vi.fn()
    const onRemovePhoto = vi.fn()

    const { container } = render(
      <IntakePhotoPicker
        photos={[]}
        onAddPhotos={onAddPhotos}
        onRemovePhoto={onRemovePhoto}
      />,
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()
    const clickSpy = vi.spyOn(fileInput, 'click')

    const addBtn = screen.getByRole('button', { name: 'Add photo' })
    fireEvent.click(addBtn)

    // Should not show popup menu
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    // Should have triggered file input directly
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('in mobile mode, clicking add opens menu with Take photo and From gallery', () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(true)
    const onAddPhotos = vi.fn()
    const onRemovePhoto = vi.fn()

    render(
      <IntakePhotoPicker
        photos={[]}
        onAddPhotos={onAddPhotos}
        onRemovePhoto={onRemovePhoto}
      />,
    )

    const addBtn = screen.getByRole('button', { name: 'Add photo' })
    fireEvent.click(addBtn)

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /take photo/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /from gallery/i })).toBeInTheDocument()
  })

  it('in mobile mode, selecting Take photo launches InAppCamera and captures photo', () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(true)
    const onAddPhotos = vi.fn()
    const onRemovePhoto = vi.fn()

    render(
      <IntakePhotoPicker
        photos={[]}
        onAddPhotos={onAddPhotos}
        onRemovePhoto={onRemovePhoto}
      />,
    )

    const addBtn = screen.getByRole('button', { name: 'Add photo' })
    fireEvent.click(addBtn)

    const takePhotoItem = screen.getByRole('menuitem', { name: /take photo/i })
    fireEvent.click(takePhotoItem)

    expect(screen.getByTestId('in-app-camera')).toBeInTheDocument()

    // Click shutter
    fireEvent.click(screen.getByRole('button', { name: 'Mock Shutter' }))

    expect(onAddPhotos).toHaveBeenCalledTimes(1)
    const [added] = onAddPhotos.mock.calls[0][0] as StagedPhoto[]
    expect(added.captureSource).toBe('camera')
    expect(added.previewUrl).toBe('blob:mock-preview-url')
    expect(screen.queryByTestId('in-app-camera')).not.toBeInTheDocument()
  })

  it('renders staged thumbnails and calls onRemovePhoto when remove button is clicked', () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(false)
    const onAddPhotos = vi.fn()
    const onRemovePhoto = vi.fn()

    const staged: StagedPhoto[] = [
      {
        id: 'photo-1',
        blob: new Blob(['1']),
        previewUrl: 'blob:photo-1',
        captureSource: 'gallery',
      },
      {
        id: 'photo-2',
        blob: new Blob(['2']),
        previewUrl: 'blob:photo-2',
        captureSource: 'camera',
      },
    ]

    render(
      <IntakePhotoPicker
        photos={staged}
        onAddPhotos={onAddPhotos}
        onRemovePhoto={onRemovePhoto}
      />,
    )

    const removeButtons = screen.getAllByRole('button', { name: 'Remove photo' })
    expect(removeButtons).toHaveLength(2)

    fireEvent.click(removeButtons[0])
    expect(onRemovePhoto).toHaveBeenCalledWith('photo-1')
  })
})
