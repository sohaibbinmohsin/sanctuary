import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingProgress } from '@/features/onboarding/components/OnboardingProgress'
import { StepIdentity } from '@/features/onboarding/components/StepIdentity'
import { StepStatuses } from '@/features/onboarding/components/StepStatuses'
import { StepLedger } from '@/features/onboarding/components/StepLedger'
import {
  DEFAULT_ONBOARDING_STATUSES,
  DEFAULT_ONBOARDING_CATEGORIES,
} from '@/features/onboarding/domain/onboarding'

describe('OnboardingProgress', () => {
  it('renders all 3 steps and marks the current step', () => {
    const { rerender } = render(<OnboardingProgress currentStep={1} />)
    expect(screen.getByText('Identity')).toBeInTheDocument()
    expect(screen.getByText('Statuses')).toBeInTheDocument()
    expect(screen.getByText('Ledger')).toBeInTheDocument()

    const step1 = screen.getByRole('listitem', { name: /Step 1: Identity/i })
    expect(step1).toHaveAttribute('aria-current', 'step')

    rerender(<OnboardingProgress currentStep={2} />)
    const step2 = screen.getByRole('listitem', { name: /Step 2: Statuses/i })
    expect(step2).toHaveAttribute('aria-current', 'step')
    expect(step1).not.toHaveAttribute('aria-current')

    rerender(<OnboardingProgress currentStep={3} />)
    const step3 = screen.getByRole('listitem', { name: /Step 3: Ledger/i })
    expect(step3).toHaveAttribute('aria-current', 'step')
  })
})

describe('StepIdentity', () => {
  it('disables continue when name is empty', () => {
    const onNext = vi.fn()
    render(
      <StepIdentity
        name=""
        initials=""
        logoFile={null}
        onNameChange={vi.fn()}
        onInitialsChange={vi.fn()}
        onLogoFileChange={vi.fn()}
        onNext={onNext}
      />,
    )
    const nextBtn = screen.getByRole('button', { name: /Continue/i })
    expect(nextBtn).toBeDisabled()
  })

  it('disables continue when name is only whitespace', () => {
    render(
      <StepIdentity
        name="   "
        initials=""
        logoFile={null}
        onNameChange={vi.fn()}
        onInitialsChange={vi.fn()}
        onLogoFileChange={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const nextBtn = screen.getByRole('button', { name: /Continue/i })
    expect(nextBtn).toBeDisabled()
  })

  it('enables continue and triggers onNext when name is provided', () => {
    const onNext = vi.fn()
    render(
      <StepIdentity
        name="Safe Haven Sanctuary"
        initials="SHS"
        logoFile={null}
        onNameChange={vi.fn()}
        onInitialsChange={vi.fn()}
        onLogoFileChange={vi.fn()}
        onNext={onNext}
      />,
    )
    const nextBtn = screen.getByRole('button', { name: /Continue/i })
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('updates name and initials on input change', () => {
    const onNameChange = vi.fn()
    const onInitialsChange = vi.fn()
    render(
      <StepIdentity
        name="Safe Haven"
        initials="SH"
        logoFile={null}
        onNameChange={onNameChange}
        onInitialsChange={onInitialsChange}
        onLogoFileChange={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const nameInput = screen.getByLabelText(/Shelter name/i)
    fireEvent.change(nameInput, { target: { value: 'New Haven' } })
    expect(onNameChange).toHaveBeenCalledWith('New Haven')

    const initialsInput = screen.getByLabelText(/initials/i)
    fireEvent.change(initialsInput, { target: { value: 'NH' } })
    expect(onInitialsChange).toHaveBeenCalledWith('NH')
  })

  it('handles logo file upload and removal', () => {
    const onLogoFileChange = vi.fn()
    const fakeFile = new File(['dummy content'], 'logo.png', { type: 'image/png' })

    const { rerender } = render(
      <StepIdentity
        name="Safe Haven"
        initials="SH"
        logoFile={null}
        onNameChange={vi.fn()}
        onInitialsChange={vi.fn()}
        onLogoFileChange={onLogoFileChange}
        onNext={vi.fn()}
      />,
    )

    const fileInput = screen.getByTestId('logo-file-input')
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })
    expect(onLogoFileChange).toHaveBeenCalledWith(fakeFile)

    // Now render with the logo file
    // Mock URL.createObjectURL and revokeObjectURL
    const mockUrl = 'blob:http://localhost/fake-logo'
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl)
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    rerender(
      <StepIdentity
        name="Safe Haven"
        initials="SH"
        logoFile={fakeFile}
        onNameChange={vi.fn()}
        onInitialsChange={vi.fn()}
        onLogoFileChange={onLogoFileChange}
        onNext={vi.fn()}
      />,
    )

    expect(screen.getByAltText(/logo/i)).toHaveAttribute('src', mockUrl)

    const removeBtn = screen.getByRole('button', { name: /Remove/i })
    fireEvent.click(removeBtn)
    expect(onLogoFileChange).toHaveBeenCalledWith(null)

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })
})

describe('StepStatuses', () => {
  it('renders default statuses and allows adding new ones', () => {
    const onStatusesChange = vi.fn()
    render(
      <StepStatuses
        statuses={[...DEFAULT_ONBOARDING_STATUSES]}
        onStatusesChange={onStatusesChange}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByDisplayValue('Intake')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Quarantine')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Treatment')).toBeInTheDocument()
    expect(screen.getByDisplayValue('In sanctuary')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Adopted')).toBeInTheDocument()
  })

  it('allows inline editing of a status label', () => {
    const onStatusesChange = vi.fn()
    render(
      <StepStatuses
        statuses={[...DEFAULT_ONBOARDING_STATUSES]}
        onStatusesChange={onStatusesChange}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const intakeInput = screen.getByDisplayValue('Intake')
    fireEvent.change(intakeInput, { target: { value: 'Intake & Assessment' } })
    expect(onStatusesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Intake & Assessment', countsAsInCare: true }),
      ]),
    )
  })

  it('allows changing in-care flag', () => {
    const onStatusesChange = vi.fn()
    render(
      <StepStatuses
        statuses={[
          { label: 'Intake', countsAsInCare: true },
          { label: 'Adopted', countsAsInCare: false },
        ]}
        onStatusesChange={onStatusesChange}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const inCareSelects = screen.getAllByRole('button', { name: /In care status/i })
    // Open select for the first item
    fireEvent.click(inCareSelects[0]!)
    const notInCareOption = screen.getByRole('option', { name: 'Not in care' })
    fireEvent.click(notInCareOption)

    expect(onStatusesChange).toHaveBeenCalledWith([
      { label: 'Intake', countsAsInCare: false },
      { label: 'Adopted', countsAsInCare: false },
    ])
  })

  it('renders drag handles for reordering statuses', () => {
    render(
      <StepStatuses
        statuses={[
          { id: '1', label: 'First', countsAsInCare: true },
          { id: '2', label: 'Second', countsAsInCare: true },
          { id: '3', label: 'Third', countsAsInCare: false },
        ]}
        onStatusesChange={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const dragHandles = screen.getAllByLabelText(/Drag to reorder/i)
    expect(dragHandles).toHaveLength(3)
  })

  it('allows adding a new status', () => {
    const onStatusesChange = vi.fn()
    render(
      <StepStatuses
        statuses={[{ id: '1', label: 'Intake', countsAsInCare: true }]}
        onStatusesChange={onStatusesChange}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const addBtn = screen.getByRole('button', { name: /Add new status/i })
    fireEvent.click(addBtn)
    expect(onStatusesChange).toHaveBeenCalledWith([
      { id: '1', label: 'Intake', countsAsInCare: true },
      expect.objectContaining({ label: '', countsAsInCare: true }),
    ])
  })

  it('allows removing a status and enforces minimum of 1 status', () => {
    const onStatusesChange = vi.fn()
    const { rerender } = render(
      <StepStatuses
        statuses={[
          { label: 'Intake', countsAsInCare: true },
          { label: 'Adopted', countsAsInCare: false },
        ]}
        onStatusesChange={onStatusesChange}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const removeButtons = screen.getAllByRole('button', { name: /Remove status/i })
    expect(removeButtons[0]).not.toBeDisabled()
    fireEvent.click(removeButtons[0]!)
    expect(onStatusesChange).toHaveBeenCalledWith([
      { label: 'Adopted', countsAsInCare: false },
    ])

    // When only 1 status remains, delete button should be disabled
    rerender(
      <StepStatuses
        statuses={[{ label: 'Adopted', countsAsInCare: false }]}
        onStatusesChange={onStatusesChange}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const singleRemoveBtn = screen.getByRole('button', { name: /Remove status/i })
    expect(singleRemoveBtn).toBeDisabled()
  })

  it('navigates back and forward', () => {
    const onBack = vi.fn()
    const onNext = vi.fn()
    render(
      <StepStatuses
        statuses={[{ label: 'Intake', countsAsInCare: true }]}
        onStatusesChange={vi.fn()}
        onBack={onBack}
        onNext={onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('disables continue when no statuses have labels', () => {
    render(
      <StepStatuses
        statuses={[{ label: '   ', countsAsInCare: true }]}
        onStatusesChange={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const nextBtn = screen.getByRole('button', { name: /Continue/i })
    expect(nextBtn).toBeDisabled()
  })
})

describe('StepLedger', () => {
  it('StepLedger renders default categories and finish button', () => {
    render(
      <StepLedger
        categories={[...DEFAULT_ONBOARDING_CATEGORIES]}
        onCategoriesChange={vi.fn()}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    expect(screen.getByDisplayValue('Donation')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Food & Nutrition')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Finish setup/i })).toBeInTheDocument()
  })

  it('allows inline editing of a category label', () => {
    const onCategoriesChange = vi.fn()
    render(
      <StepLedger
        categories={[...DEFAULT_ONBOARDING_CATEGORIES]}
        onCategoriesChange={onCategoriesChange}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    const donationInput = screen.getByDisplayValue('Donation')
    fireEvent.change(donationInput, { target: { value: 'Individual Donations' } })
    expect(onCategoriesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Individual Donations', direction: 'in' }),
      ]),
    )
  })

  it('allows changing category direction', () => {
    const onCategoriesChange = vi.fn()
    render(
      <StepLedger
        categories={[
          { label: 'Donation', direction: 'in' },
          { label: 'Food', direction: 'out' },
        ]}
        onCategoriesChange={onCategoriesChange}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    const directionSelects = screen.getAllByRole('button', { name: /Direction/i })
    // Open select for Donation
    fireEvent.click(directionSelects[0]!)
    const moneyOutOption = screen.getByRole('option', { name: 'Money out' })
    fireEvent.click(moneyOutOption)

    expect(onCategoriesChange).toHaveBeenCalledWith([
      { label: 'Donation', direction: 'out' },
      { label: 'Food', direction: 'out' },
    ])
  })

  it('allows adding a new category', () => {
    const onCategoriesChange = vi.fn()
    render(
      <StepLedger
        categories={[{ id: '1', label: 'Donation', direction: 'in' }]}
        onCategoriesChange={onCategoriesChange}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    const addBtn = screen.getByRole('button', { name: /Add new category/i })
    fireEvent.click(addBtn)
    expect(onCategoriesChange).toHaveBeenCalledWith([
      { id: '1', label: 'Donation', direction: 'in' },
      expect.objectContaining({ label: '', direction: 'out' }),
    ])
  })

  it('allows removing a category and enforces minimum of 1 category', () => {
    const onCategoriesChange = vi.fn()
    const { rerender } = render(
      <StepLedger
        categories={[
          { label: 'Donation', direction: 'in' },
          { label: 'Food', direction: 'out' },
        ]}
        onCategoriesChange={onCategoriesChange}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    const removeButtons = screen.getAllByRole('button', { name: /Remove category/i })
    expect(removeButtons[0]).not.toBeDisabled()
    fireEvent.click(removeButtons[0]!)
    expect(onCategoriesChange).toHaveBeenCalledWith([
      { label: 'Food', direction: 'out' },
    ])

    // When only 1 category remains, delete button should be disabled
    rerender(
      <StepLedger
        categories={[{ label: 'Food', direction: 'out' }]}
        onCategoriesChange={onCategoriesChange}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    const singleRemoveBtn = screen.getByRole('button', { name: /Remove category/i })
    expect(singleRemoveBtn).toBeDisabled()
  })

  it('displays error message when provided', () => {
    render(
      <StepLedger
        categories={[{ label: 'Donation', direction: 'in' }]}
        onCategoriesChange={vi.fn()}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        busy={false}
        error="Network error occurred during setup."
      />,
    )
    expect(screen.getByText('Network error occurred during setup.')).toBeInTheDocument()
  })

  it('disables finish button when busy or when no category has a label', () => {
    const onFinish = vi.fn()
    const { rerender } = render(
      <StepLedger
        categories={[{ label: 'Donation', direction: 'in' }]}
        onCategoriesChange={vi.fn()}
        onBack={vi.fn()}
        onFinish={onFinish}
        busy={true}
        error={null}
      />,
    )
    const finishBtn = screen.getByRole('button', { name: /Finishing setup|Finish setup/i })
    expect(finishBtn).toBeDisabled()

    rerender(
      <StepLedger
        categories={[{ label: '   ', direction: 'in' }]}
        onCategoriesChange={vi.fn()}
        onBack={vi.fn()}
        onFinish={onFinish}
        busy={false}
        error={null}
      />,
    )
    expect(screen.getByRole('button', { name: /Finish setup/i })).toBeDisabled()
  })

  it('navigates back and triggers finish on click', () => {
    const onBack = vi.fn()
    const onFinish = vi.fn()
    render(
      <StepLedger
        categories={[{ label: 'Donation', direction: 'in' }]}
        onCategoriesChange={vi.fn()}
        onBack={onBack}
        onFinish={onFinish}
        busy={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Finish setup/i }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
