import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusSingleSelect } from '@/features/animals/components/StatusSingleSelect'
import { setSingleStatusAssignment } from '@/features/statuses/domain/assignments'
import type { AnimalStatus } from '@/features/statuses/domain/statuses'

const mockStatuses: AnimalStatus[] = [
  { id: 'st-intake', org_id: 'org-1', label: 'Intake', sort_order: 1, counts_as_in_care: 1, archived: 0, created_at: '' },
  { id: 'st-foster', org_id: 'org-1', label: 'Foster', sort_order: 2, counts_as_in_care: 1, archived: 0, created_at: '' },
  { id: 'st-adopted', org_id: 'org-1', label: 'Adopted', sort_order: 3, counts_as_in_care: 0, archived: 0, created_at: '' },
  { id: 'st-archived', org_id: 'org-1', label: 'Old Status', sort_order: 4, counts_as_in_care: 0, archived: 1, created_at: '' },
]

describe('StatusSingleSelect', () => {
  it('allows selecting only one status at a time, switching when another is clicked', () => {
    const onSelect = vi.fn()
    render(
      <StatusSingleSelect
        statuses={mockStatuses}
        value="st-intake"
        onChange={onSelect}
      />
    )

    const intakePill = screen.getByRole('button', { name: /Intake/i })
    expect(intakePill).toHaveClass('is-selected')

    const fosterPill = screen.getByRole('button', { name: /Foster/i })
    fireEvent.click(fosterPill)

    expect(onSelect).toHaveBeenCalledWith('st-foster')
  })

  it('filters out archived statuses from the pill list', () => {
    render(
      <StatusSingleSelect
        statuses={mockStatuses}
        value="st-intake"
        onChange={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Old Status/i })).toBeNull()
  })

  it('calls onAddStatus when Add button is clicked', () => {
    const onAdd = vi.fn()
    render(
      <StatusSingleSelect
        statuses={mockStatuses}
        value="st-intake"
        onChange={vi.fn()}
        onAddStatus={onAdd}
      />
    )

    const addBtn = screen.getByRole('button', { name: /Add new status/i })
    fireEvent.click(addBtn)
    expect(onAdd).toHaveBeenCalled()
  })

  it('disables pills when disabled prop is true', () => {
    render(
      <StatusSingleSelect
        statuses={mockStatuses}
        value="st-intake"
        onChange={vi.fn()}
        disabled
      />
    )

    const intakePill = screen.getByRole('button', { name: /Intake/i })
    expect(intakePill).toBeDisabled()
  })
})

describe('setSingleStatusAssignment', () => {
  it('updates animals.status_id directly', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const getOptional = vi.fn().mockResolvedValue({ label: 'Foster' })
    const db = { execute, getOptional } as never

    await setSingleStatusAssignment(db, {
      animalId: 'anim-1',
      orgId: 'org-1',
      statusId: 'st-foster',
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0]![0]).toContain('UPDATE animals SET status_id = ?')
    expect(execute.mock.calls[0]![1]).toEqual([
      'st-foster',
      expect.any(String),
      'anim-1',
    ])
  })
})
