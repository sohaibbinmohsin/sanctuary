import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'

afterEach(() => {
  document.body.style.overflow = ''
})

describe('ResponsiveSheetModal', () => {
  it('renders modal when open with title, children, backdrop, without header cross, and calls onClose on backdrop click', () => {
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

    // Header close cross should NOT be rendered
    expect(screen.queryByLabelText(/Close modal/i)).toBeNull()

    const backdrop = document.querySelector('.responsive-modal__backdrop')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
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

  it('restores page scroll after a nested sheet closes and the outer sheet closes', () => {
    function Sheets() {
      const [outerOpen, setOuterOpen] = useState(true)
      const [innerOpen, setInnerOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setInnerOpen(true)}>
            Open age
          </button>
          <button type="button" onClick={() => setInnerOpen(false)}>
            Close age
          </button>
          <button type="button" onClick={() => setOuterOpen(false)}>
            Close edit
          </button>
          <ResponsiveSheetModal
            isOpen={outerOpen}
            onClose={() => setOuterOpen(false)}
            title="Edit details"
          >
            <p>Details form</p>
          </ResponsiveSheetModal>
          <ResponsiveSheetModal
            isOpen={innerOpen}
            onClose={() => setInnerOpen(false)}
            title="Age"
          >
            <p>Age wheels</p>
          </ResponsiveSheetModal>
        </>
      )
    }

    render(<Sheets />)
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Open age' }))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Close age' }))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Close edit' }))
    expect(document.body.style.overflow).toBe('')
  })
})
