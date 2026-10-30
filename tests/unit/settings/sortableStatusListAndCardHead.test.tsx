import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SortableStatusList } from '@/features/settings/components/SortableStatusList'
import { SettingsCardHead } from '@/features/settings/components/SettingsCardHead'
import type { AnimalStatus } from '@/features/statuses/domain/statuses'

describe('SortableStatusList', () => {
  const mockStatuses: AnimalStatus[] = [
    {
      id: 'st-intake',
      org_id: 'org-1',
      label: 'Intake',
      sort_order: 1,
      counts_as_in_care: 1,
      archived: 0,
      created_at: '2026-10-09T00:00:00Z',
    },
    {
      id: 'st-released',
      org_id: 'org-1',
      label: 'Released',
      sort_order: 2,
      counts_as_in_care: 0,
      archived: 0,
      created_at: '2026-10-09T00:00:00Z',
    },
    {
      id: 'st-custom',
      org_id: 'org-1',
      label: 'Foster Trial',
      sort_order: 3,
      counts_as_in_care: 1,
      archived: 0,
      created_at: '2026-10-09T00:00:00Z',
    },
  ]

  it('disables name and in-care inputs for default statuses and hides the Hide button', () => {
    render(
      <SortableStatusList
        statuses={mockStatuses}
        onReorder={vi.fn()}
        onRename={vi.fn()}
        onLabelChange={vi.fn()}
        onInCareChange={vi.fn()}
        onHide={vi.fn()}
      />
    )

    const inputs = screen.getAllByLabelText('Status name')
    expect(inputs).toHaveLength(3)

    // Intake (required default) is disabled
    expect(inputs[0]).toBeDisabled()
    expect(inputs[0]).toHaveValue('Intake')

    // Released (default, but non-intake) is now editable
    expect(inputs[1]).not.toBeDisabled()
    expect(inputs[1]).toHaveValue('Released')

    // Custom status is editable
    expect(inputs[2]).not.toBeDisabled()
    expect(inputs[2]).toHaveValue('Foster Trial')

    // Both Released and custom status have Hide buttons (Intake does not)
    const hideButtons = screen.getAllByRole('button', { name: /hide/i })
    expect(hideButtons).toHaveLength(2)
  })
})

describe('SettingsCardHead', () => {
  it('renders prominent Done button with primary variant class when editing', () => {
    const { rerender } = render(
      <SettingsCardHead
        title="Animal statuses"
        description="Configure statuses"
        editing={false}
        onToggle={vi.fn()}
      />
    )

    const editBtn = screen.getByRole('button', { name: 'Edit' })
    expect(editBtn).toHaveClass('btn--secondary')

    rerender(
      <SettingsCardHead
        title="Animal statuses"
        description="Configure statuses"
        editing={true}
        onToggle={vi.fn()}
      />
    )

    const doneBtn = screen.getByRole('button', { name: 'Done' })
    expect(doneBtn).toHaveClass('btn--primary')
  })
})
