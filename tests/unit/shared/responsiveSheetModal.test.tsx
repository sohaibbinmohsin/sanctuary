import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'

describe('ResponsiveSheetModal', () => {
  it('renders modal when open with title, children, backdrop, and calls onClose on backdrop click or close button', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <ResponsiveSheetModal isOpen={false} onClose={onClose} title="Update Status">
        <p>Form Content</p>
      </ResponsiveSheetModal>
    )

    expect(screen.queryByText('Update Status')).toBeNull()

    rerender(
      <ResponsiveSheetModal isOpen={true} onClose={onClose} title="Update Status">
        <p>Form Content</p>
      </ResponsiveSheetModal>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Update Status')).toBeInTheDocument()
    expect(screen.getByText('Form Content')).toBeInTheDocument()

    const closeBtn = screen.getByLabelText(/Close modal/i)
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    const backdrop = document.querySelector('.responsive-modal__backdrop')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes on Escape key press when open and cleans up listeners', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <ResponsiveSheetModal isOpen={true} onClose={onClose} title="Update Status">
        <p>Form Content</p>
      </ResponsiveSheetModal>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
