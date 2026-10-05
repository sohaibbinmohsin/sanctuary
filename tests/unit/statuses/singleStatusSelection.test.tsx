import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusSingleSelect } from '@/features/animals/components/StatusSingleSelect'
import { setSingleStatusAssignment } from '@/features/statuses/domain/assignments'
import type { AnimalStatus } from '@/features/statuses/domain/statuses'

const mockStatuses: AnimalStatus[] = [
  { id: 'st-intake', org_id: 'org-1', label: 'Intake', sort_order: 1, counts_as_in_care: 1, archived: 0, is_default_arrival: 1, created_at: '', updated_at: '' },
  { id: 'st-foster', org_id: 'org-1', label: 'Foster', sort_order: 2, counts_as_in_care: 1, archived: 0, is_default_arrival: 0, created_at: '', updated_at: '' },
  { id: 'st-adopted', org_id: 'org-1', label: 'Adopted', sort_order: 3, counts_as_in_care: 0, archived: 0, is_default_arrival: 0, created_at: '', updated_at: '' },
  { id: 'st-archived', org_id: 'org-1', label: 'Old Status', sort_order: 4, counts_as_in_care: 0, archived: 1, is_default_arrival: 0, created_at: '', updated_at: '' },
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
  it('deletes previous assignments, inserts the single assignment, and updates animals table', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = { execute } as never

    await setSingleStatusAssignment(db, {
      animalId: 'anim-1',
      orgId: 'org-1',
      statusId: 'st-foster',
    })

    expect(execute).toHaveBeenCalledTimes(3)
    // 1. DELETE
    expect(execute.mock.calls[0][0]).toContain('DELETE FROM animal_status_assignments WHERE animal_id = ?')
    expect(execute.mock.calls[0][1]).toEqual(['anim-1'])

    // 2. INSERT
    expect(execute.mock.calls[1][0]).toContain('INSERT INTO animal_status_assignments')
    expect(execute.mock.calls[1][1]).toEqual(
      expect.arrayContaining(['anim-1', 'st-foster'])
    )

    // 3. UPDATE animals
    expect(execute.mock.calls[2][0]).toContain('UPDATE animals SET status_id = ?')
    expect(execute.mock.calls[2][1]).toEqual(
      expect.arrayContaining(['st-foster', 'anim-1'])
    )
  })
})
