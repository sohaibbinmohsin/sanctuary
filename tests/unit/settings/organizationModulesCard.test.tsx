import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OrganizationModulesCard } from '@/features/settings/components/OrganizationModulesCard'

describe('OrganizationModulesCard', () => {
  it('renders summary when closed and checkboxes when edit is clicked', () => {
    const onSave = vi.fn()
    render(
      <OrganizationModulesCard
        enabledModules={new Set(['animals', 'checklist'])}
        canManage={true}
        onSave={onSave}
      />,
    )

    expect(screen.getByText('Organization modules')).toBeInTheDocument()
    // In summary view, shows enabled and disabled modules
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Animal Records')).toBeInTheDocument()
    expect(screen.getByText('Daily Checklist')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByText('Rescue Reports')).toBeInTheDocument()
    expect(screen.getByText('Financial Ledger')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Rescue Reports/i)).not.toBeInTheDocument()

    // Click Edit
    const editBtn = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editBtn)

    // Now checkboxes are shown
    expect(screen.getByLabelText(/Rescue Reports/i)).not.toBeChecked()
    expect(screen.getByLabelText(/Animal Records/i)).toBeChecked()
    expect(screen.getByLabelText(/Daily Checklist/i)).toBeChecked()
    expect(screen.getByLabelText(/Financial Ledger/i)).not.toBeChecked()
  })

  it('calls onSave with updated modules and shows confirmation', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <OrganizationModulesCard
        enabledModules={new Set(['animals', 'checklist'])}
        canManage={true}
        onSave={onSave}
      />,
    )

    // Click Edit to enter edit mode
    const editBtn = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editBtn)

    // Toggle Rescue Reports on
    const reportsCheckbox = screen.getByLabelText(/Rescue Reports/i)
    fireEvent.click(reportsCheckbox)
    expect(reportsCheckbox).toBeChecked()

    // Click Done button to save
    const doneButton = screen.getByRole('button', { name: /Done/i })
    fireEvent.click(doneButton)

    expect(onSave).toHaveBeenCalledWith(['reports', 'animals', 'checklist'])
    expect(await screen.findByText(/Modules saved/i)).toBeInTheDocument()
  })

  it('disables unchecking the last enabled module to ensure at least one module remains enabled', () => {
    const onSave = vi.fn()
    render(
      <OrganizationModulesCard
        enabledModules={new Set(['animals'])}
        canManage={true}
        onSave={onSave}
      />,
    )

    const editBtn = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editBtn)

    const animalsCheckbox = screen.getByLabelText(/Animal Records/i)
    expect(animalsCheckbox).toBeChecked()
    expect(animalsCheckbox).toBeDisabled()
  })
})
