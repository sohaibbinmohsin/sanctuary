import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PublicReportStepAnimal } from '@/features/reports/components/public/PublicReportStepAnimal'
import { INITIAL_DRAFT } from '@/features/reports/hooks/useReportDraft'

describe('PublicReportStepAnimal', () => {
  it('renders category and species presets', () => {
    render(<PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('Medical emergency')).toBeInTheDocument()
    expect(screen.getByText('Animal cruelty')).toBeInTheDocument()
    expect(screen.getByText('Dog')).toBeInTheDocument()
    expect(screen.getByText('Cat')).toBeInTheDocument()
    expect(screen.getByText('Horse')).toBeInTheDocument()
    expect(screen.getByText('Donkey')).toBeInTheDocument()
    expect(screen.getByText('Bird')).toBeInTheDocument()
  })

  it('renders quick complaint buttons that append to complaint input', () => {
    const onUpdate = vi.fn()
    render(<PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={onUpdate} onNext={vi.fn()} />)
    const quickTag = screen.getByText('+ Hit by vehicle')
    fireEvent.click(quickTag)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ chiefComplaint: 'Hit by vehicle' }))
  })

  it('appends quick complaints with comma when draft already has complaint text', () => {
    const onUpdate = vi.fn()
    const draft = { ...INITIAL_DRAFT, chiefComplaint: 'Limping badly' }
    render(<PublicReportStepAnimal draft={draft} onUpdate={onUpdate} onNext={vi.fn()} />)
    const quickTag = screen.getByText('+ Severe bleeding')
    fireEvent.click(quickTag)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ chiefComplaint: 'Limping badly, Severe bleeding' }))
  })

  it('does not duplicate quick complaint if already present in complaint text', () => {
    const onUpdate = vi.fn()
    const draft = { ...INITIAL_DRAFT, chiefComplaint: 'Severe bleeding' }
    render(<PublicReportStepAnimal draft={draft} onUpdate={onUpdate} onNext={vi.fn()} />)
    const quickTag = screen.getByText('+ Severe bleeding')
    fireEvent.click(quickTag)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('updates category on click', () => {
    const onUpdate = vi.fn()
    render(<PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={onUpdate} onNext={vi.fn()} />)
    fireEvent.click(screen.getByText('Animal cruelty'))
    expect(onUpdate).toHaveBeenCalledWith({ category: 'cruelty' })
  })

  it('updates animal composition mode and counts', () => {
    const onUpdate = vi.fn()
    render(<PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={onUpdate} onNext={vi.fn()} />)
    fireEvent.click(screen.getByText('Litter or Family'))
    expect(onUpdate).toHaveBeenCalledWith({ intakeCountMode: 'litter', animalCount: 2 })

    fireEvent.click(screen.getByText('Multiple Animals'))
    expect(onUpdate).toHaveBeenCalledWith({ intakeCountMode: 'multiple', animalCount: 2 })
  })

  it('renders stepper controls when count mode is not single', () => {
    const onUpdate = vi.fn()
    const draft = { ...INITIAL_DRAFT, intakeCountMode: 'multiple' as const, animalCount: 3 }
    render(<PublicReportStepAnimal draft={draft} onUpdate={onUpdate} onNext={vi.fn()} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    const decreaseBtn = screen.getByLabelText('Decrease count')
    const increaseBtn = screen.getByLabelText('Increase count')

    fireEvent.click(decreaseBtn)
    expect(onUpdate).toHaveBeenCalledWith({ animalCount: 2 })

    fireEvent.click(increaseBtn)
    expect(onUpdate).toHaveBeenCalledWith({ animalCount: 4 })
  })

  it('disables decrease button when count is 2 or less', () => {
    const draft = { ...INITIAL_DRAFT, intakeCountMode: 'multiple' as const, animalCount: 2 }
    render(<PublicReportStepAnimal draft={draft} onUpdate={vi.fn()} onNext={vi.fn()} />)
    const decreaseBtn = screen.getByLabelText('Decrease count')
    expect(decreaseBtn).toBeDisabled()
  })

  it('shows avian sub-types when Bird is selected', () => {
    const draft = { ...INITIAL_DRAFT, speciesPreset: 'Bird' }
    const onUpdate = vi.fn()
    render(<PublicReportStepAnimal draft={draft} onUpdate={onUpdate} onNext={vi.fn()} />)
    expect(screen.getByText('Black Kite')).toBeInTheDocument()
    expect(screen.getByText('Eagle')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Black Kite'))
    expect(onUpdate).toHaveBeenCalledWith({ avianSubtype: 'Black Kite' })
  })

  it('shows custom animal input when Other is selected', () => {
    const draft = { ...INITIAL_DRAFT, speciesPreset: 'Other', speciesOther: '' }
    const onUpdate = vi.fn()
    render(<PublicReportStepAnimal draft={draft} onUpdate={onUpdate} onNext={vi.fn()} />)
    const input = screen.getByPlaceholderText('e.g. Goat, Falcon, Rabbit')
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'Goat' } })
    expect(onUpdate).toHaveBeenCalledWith({ speciesOther: 'Goat' })
  })

  it('handles form submission when complaint is entered', () => {
    const onNext = vi.fn()
    const draft = { ...INITIAL_DRAFT, chiefComplaint: 'Injured bird on road' }
    render(<PublicReportStepAnimal draft={draft} onUpdate={vi.fn()} onNext={onNext} />)
    const submitBtn = screen.getByRole('button', { name: /continue to location/i })
    expect(submitBtn).not.toBeDisabled()

    fireEvent.click(submitBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('disables continue button when chief complaint is empty', () => {
    const onNext = vi.fn()
    render(<PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={vi.fn()} onNext={onNext} />)
    const submitBtn = screen.getByRole('button', { name: /continue to location/i })
    expect(submitBtn).toBeDisabled()
  })

  it('contains strictly zero em-dashes', () => {
    const { container } = render(
      <PublicReportStepAnimal draft={INITIAL_DRAFT} onUpdate={vi.fn()} onNext={vi.fn()} />
    )
    expect(container.textContent).not.toContain('\u2014')
    expect(container.textContent).not.toContain('--')
  })
})
