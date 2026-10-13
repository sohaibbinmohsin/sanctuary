import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OrganizationModulesCard } from '@/features/settings/components/OrganizationModulesCard'

describe('OrganizationModulesCard', () => {
  it('renders presets and individual module checkboxes', () => {
    const onSave = vi.fn()
    render(
      <OrganizationModulesCard
        enabledModules={new Set(['animals', 'checklist'])}
        canManage={true}
        onSave={onSave}
      />,
    )

    expect(screen.getByText('Organization Modules')).toBeInTheDocument()
    expect(screen.getByLabelText(/Rescue Reports/i)).not.toBeChecked()
    expect(screen.getByLabelText(/Animal Records/i)).toBeChecked()
    expect(screen.getByLabelText(/Daily Checklist/i)).toBeChecked()
    expect(screen.getByLabelText(/Financial Ledger/i)).not.toBeChecked()
  })

  it('updates checkboxes when selecting a preset', () => {
    const onSave = vi.fn()
    render(
      <OrganizationModulesCard
        enabledModules={new Set(['animals'])}
        canManage={true}
        onSave={onSave}
      />,
    )

    const presetSelect = screen.getByLabelText(/Account Preset/i)
    fireEvent.change(presetSelect, { target: { value: 'full' } })

    expect(screen.getByLabelText(/Rescue Reports/i)).toBeChecked()
    expect(screen.getByLabelText(/Animal Records/i)).toBeChecked()
    expect(screen.getByLabelText(/Daily Checklist/i)).toBeChecked()
    expect(screen.getByLabelText(/Financial Ledger/i)).toBeChecked()
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

    // Toggle Rescue Reports on
    const reportsCheckbox = screen.getByLabelText(/Rescue Reports/i)
    fireEvent.click(reportsCheckbox)
    expect(reportsCheckbox).toBeChecked()

    // Click Save modules button
    const saveButton = screen.getByRole('button', { name: /Save modules/i })
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledWith(['reports', 'animals', 'checklist'])
    expect(await screen.findByText(/Modules saved/i)).toBeInTheDocument()
  })
})
