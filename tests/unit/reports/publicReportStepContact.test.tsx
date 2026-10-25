import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PublicReportStepContact } from '@/features/reports/components/public/PublicReportStepContact'
import { INITIAL_DRAFT } from '@/features/reports/hooks/useReportDraft'
import type { PublicPhotoItem } from '@/features/reports/components/public/PublicReportStepLocation'

describe('PublicReportStepContact', () => {
  const dummyPhotos: PublicPhotoItem[] = [
    { id: 'p1', url: 'blob:p1', blob: new Blob() },
    { id: 'p2', url: 'blob:p2', blob: new Blob() },
  ]

  it('renders phone input and optional CNIC', () => {
    render(
      <PublicReportStepContact
        draft={INITIAL_DRAFT}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/Mobile phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/CNIC/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit Emergency Report/i })).toBeInTheDocument()
  })

  it('validates phone number format', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepContact
        draft={INITIAL_DRAFT}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={onUpdate}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const phoneInput = screen.getByLabelText(/Mobile phone/i)
    fireEvent.change(phoneInput, { target: { value: '0300 1234567' } })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ reporterPhone: '0300 1234567' }))
  })

  it('formats phone number on change', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepContact
        draft={INITIAL_DRAFT}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={onUpdate}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const phoneInput = screen.getByLabelText(/Mobile phone/i)
    fireEvent.change(phoneInput, { target: { value: '03001234567' } })
    expect(onUpdate).toHaveBeenCalledWith({ reporterPhone: '0300 1234567' })
  })

  it('formats CNIC on change', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepContact
        draft={INITIAL_DRAFT}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={onUpdate}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const cnicInput = screen.getByLabelText(/CNIC/i)
    fireEvent.change(cnicInput, { target: { value: '4210112345671' } })
    expect(onUpdate).toHaveBeenCalledWith({ reporterCnic: '42101-1234567-1' })
  })

  it('updates reporter name on change', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepContact
        draft={INITIAL_DRAFT}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={onUpdate}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const nameInput = screen.getByLabelText(/Your name/i)
    fireEvent.change(nameInput, { target: { value: 'Usman Ali' } })
    expect(onUpdate).toHaveBeenCalledWith({ reporterName: 'Usman Ali' })
  })

  it('toggles remember profile checkbox', () => {
    const onUpdate = vi.fn()
    render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, rememberProfile: true }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={onUpdate}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const checkbox = screen.getByRole('checkbox', {
      name: /Remember my contact details on this device for future rescue reports/i,
    })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(onUpdate).toHaveBeenCalledWith({ rememberProfile: false })
  })

  it('shows valid hint when phone is valid and displays error hint when phone is invalid', () => {
    const { rerender } = render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText(/Valid mobile number/i)).toBeInTheDocument()

    rerender(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText(/Phone number is too short/i)).toBeInTheDocument()
  })

  it('shows valid hint when CNIC is valid and displays error hint when CNIC is invalid', () => {
    const { rerender } = render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567', reporterCnic: '42101-1234567-1' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText(/Valid CNIC/i)).toBeInTheDocument()

    rerender(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567', reporterCnic: '42101' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText(/CNIC must be 13 digits/i)).toBeInTheDocument()
  })

  it('disables submit button when phone is empty or invalid', () => {
    const { rerender } = render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const submitBtn = screen.getByRole('button', { name: /Submit Emergency Report/i })
    expect(submitBtn).toBeDisabled()

    rerender(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '123' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(submitBtn).toBeDisabled()
  })

  it('disables submit button when CNIC is invalid', () => {
    render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567', reporterCnic: '42101' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const submitBtn = screen.getByRole('button', { name: /Submit Emergency Report/i })
    expect(submitBtn).toBeDisabled()
  })

  it('enables submit button and calls onSubmit when valid', () => {
    const onSubmit = vi.fn()
    render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567', reporterCnic: '' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />
    )
    const submitBtn = screen.getByRole('button', { name: /Submit Emergency Report/i })
    expect(submitBtn).not.toBeDisabled()

    fireEvent.click(submitBtn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), '')
  })

  it('passes honeypot trap value to onSubmit when filled by bot', () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />
    )
    const trapInput = container.querySelector('input[name="sanctuary_security_trap"]')
    expect(trapInput).toBeInTheDocument()
    if (trapInput) {
      fireEvent.change(trapInput, { target: { value: 'spam-bot-token' } })
    }

    const submitBtn = screen.getByRole('button', { name: /Submit Emergency Report/i })
    fireEvent.click(submitBtn)
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), 'spam-bot-token')
  })

  it('handles back button click and submitting disabled state', () => {
    const onBack = vi.fn()
    const { rerender } = render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567' }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={onBack}
        onSubmit={vi.fn()}
      />
    )
    const backBtn = screen.getByRole('button', { name: /Back/i })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)

    rerender(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567' }}
        photos={[]}
        submitting={true}
        error={null}
        onUpdate={vi.fn()}
        onBack={onBack}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Back/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Submitting report\.\.\./i })).toBeDisabled()
  })

  it('displays error banner if error message is present', () => {
    render(
      <PublicReportStepContact
        draft={{ ...INITIAL_DRAFT, reporterPhone: '0300 1234567' }}
        photos={[]}
        submitting={false}
        error="Unable to submit rescue report. Please try again."
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Unable to submit rescue report. Please try again.')).toBeInTheDocument()
  })

  it('renders summary card with animal, complaint, location, and photos', () => {
    const draft = {
      ...INITIAL_DRAFT,
      speciesPreset: 'Cat',
      animalCount: 3,
      chiefComplaint: 'Fractured leg and dehydrated',
      city: 'Karachi',
      locationArea: 'Clifton Block 4',
      locationLandmark: 'Near Boat Basin',
    }
    render(
      <PublicReportStepContact
        draft={draft}
        photos={dummyPhotos}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByText('Report Summary')).toBeInTheDocument()
    expect(screen.getByText('Cat · 3')).toBeInTheDocument()
    expect(screen.getByText('Fractured leg and dehydrated')).toBeInTheDocument()
    expect(screen.getByText('Clifton Block 4, Karachi (Near Boat Basin)')).toBeInTheDocument()
    expect(screen.getByText('2 attached')).toBeInTheDocument()
  })

  it('renders summary card with avian subtype and custom other species', () => {
    const birdDraft = {
      ...INITIAL_DRAFT,
      speciesPreset: 'Bird',
      avianSubtype: 'Black Kite',
      animalCount: 1,
      chiefComplaint: 'Entangled in kite string',
      city: 'Lahore',
      locationArea: 'Anarkali',
      locationLandmark: '',
    }
    const { rerender } = render(
      <PublicReportStepContact
        draft={birdDraft}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Bird (Black Kite) · 1')).toBeInTheDocument()

    const otherDraft = {
      ...INITIAL_DRAFT,
      speciesPreset: 'Other',
      speciesOther: 'Goat',
      animalCount: 2,
      chiefComplaint: 'Injured by traffic',
      city: 'Islamabad',
      locationArea: 'F-7 Markaz',
      locationLandmark: '',
    }
    rerender(
      <PublicReportStepContact
        draft={otherDraft}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Goat · 2')).toBeInTheDocument()
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <PublicReportStepContact
        draft={{
          ...INITIAL_DRAFT,
          reporterPhone: '0300 1234567',
          chiefComplaint: 'Injured dog',
          locationArea: 'Gulberg',
        }}
        photos={[]}
        submitting={false}
        error={null}
        onUpdate={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(container.textContent).not.toContain('\u2014')
    expect(container.textContent).not.toContain('--')
  })
})
