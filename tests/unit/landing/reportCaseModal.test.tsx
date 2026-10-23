import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReportCaseModal } from '@/features/landing/components/ReportCaseModal'

describe('ReportCaseModal', () => {
  it('does not render when isOpen is false', () => {
    render(<ReportCaseModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders modal with form fields when isOpen is true', () => {
    render(<ReportCaseModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Animal and condition/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Contact phone/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit report/i })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(<ReportCaseModal isOpen={true} onClose={handleClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Close report dialog/i }))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('shows confirmation state upon submitting form', () => {
    render(<ReportCaseModal isOpen={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Animal and condition/i), { target: { value: 'Injured stray dog' } })
    fireEvent.change(screen.getByLabelText(/Location/i), { target: { value: 'Gulberg, Lahore' } })
    fireEvent.change(screen.getByLabelText(/Contact phone/i), { target: { value: '03001234567' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }))
    expect(screen.getByText(/Report submitted/i)).toBeInTheDocument()
    expect(screen.getByText(/Routed to partner rescue networks/i)).toBeInTheDocument()
  })
})
