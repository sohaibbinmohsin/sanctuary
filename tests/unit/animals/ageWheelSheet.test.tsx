import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AgeWheelSheet } from '@/features/animals/components/AgeWheelSheet'

describe('AgeWheelSheet', () => {
  it('offers years 0 through 20 and months 0 through 11 and no typed number', () => {
    render(
      <AgeWheelSheet open years={0} months={0} onCancel={() => {}} onDone={() => {}} />,
    )

    const yearsLabel = screen.getByText('Years')
    const monthsLabel = screen.getByText('Months')
    expect(yearsLabel.compareDocumentPosition(monthsLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const years = screen.getByRole('listbox', { name: 'Years' })
    const months = screen.getByRole('listbox', { name: 'Months' })
    expect(within(years).getByRole('option', { name: '0' })).toBeInTheDocument()
    expect(within(years).getByRole('option', { name: '20' })).toBeInTheDocument()
    expect(within(years).queryByRole('option', { name: '21' })).toBeNull()
    expect(within(months).getByRole('option', { name: '0' })).toBeInTheDocument()
    expect(within(months).getByRole('option', { name: '11' })).toBeInTheDocument()
    expect(within(months).queryByRole('option', { name: '12' })).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.querySelector('input')).toBeNull()
  })

  it('saves the wheels that are selected when Done is pressed', () => {
    const onDone = vi.fn()
    render(
      <AgeWheelSheet open years={0} months={0} onCancel={() => {}} onDone={onDone} />,
    )

    fireEvent.click(within(screen.getByRole('listbox', { name: 'Years' })).getByRole('option', { name: '2' }))
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Months' })).getByRole('option', { name: '6' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onDone).toHaveBeenCalledWith({ years: 2, months: 6 })
  })

  it('discards a wheel change when Cancel is pressed', () => {
    const onDone = vi.fn()
    const onCancel = vi.fn()
    render(
      <AgeWheelSheet open years={0} months={0} onCancel={onCancel} onDone={onDone} />,
    )

    fireEvent.click(within(screen.getByRole('listbox', { name: 'Years' })).getByRole('option', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('starts again from the saved age after Cancel', () => {
    const { rerender } = render(
      <AgeWheelSheet open years={0} months={0} onCancel={() => {}} onDone={() => {}} />,
    )
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Years' })).getByRole('option', { name: '4' }))
    rerender(
      <AgeWheelSheet open={false} years={0} months={0} onCancel={() => {}} onDone={() => {}} />,
    )
    rerender(
      <AgeWheelSheet open years={0} months={0} onCancel={() => {}} onDone={() => {}} />,
    )

    expect(
      within(screen.getByRole('listbox', { name: 'Years' })).getByRole('option', { name: '0' }),
    ).toHaveAttribute('aria-selected', 'true')
  })
})