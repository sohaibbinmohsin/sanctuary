import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StatusMultiSelect } from '@/features/animals/components/StatusMultiSelect'
import { CreateStatusModal } from '@/features/statuses/components/CreateStatusModal'
import { CreateCategoryModal } from '@/features/ledger/components/CreateCategoryModal'
import * as statusesModule from '@/features/statuses/domain/statuses'
import * as ledgerModule from '@/features/ledger/domain/ledger'
import type { AnimalStatus } from '@/features/statuses/domain/statuses'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    execute: vi.fn(),
    getAll: vi.fn(),
    getOptional: vi.fn(),
    writeTransaction: vi.fn(),
  }),
}))

describe('StatusMultiSelect empty status Add button', () => {
  it('renders "Add status" button and "No statuses yet." only when statuses array is empty', () => {
    const onAddStatus = vi.fn()
    const { rerender } = render(
      <StatusMultiSelect
        statuses={[]}
        value={[]}
        onChange={vi.fn()}
        onAddStatus={onAddStatus}
      />,
    )

    expect(screen.getByText('No statuses yet.')).toBeInTheDocument()
    const addBtn = screen.getByRole('button', { name: /Add status/i })
    expect(addBtn).toBeInTheDocument()

    fireEvent.click(addBtn)
    expect(onAddStatus).toHaveBeenCalledTimes(1)

    // Now re-render with statuses available — Add button should NOT be shown
    const mockStatus: AnimalStatus = {
      id: 'status-1',
      org_id: 'org-1',
      label: 'Intake',
      sort_order: 1,
      counts_as_in_care: 1,
      archived: 0,
      created_at: '2026-10-04T00:00:00Z',
    }

    rerender(
      <StatusMultiSelect
        statuses={[mockStatus]}
        value={['status-1']}
        onChange={vi.fn()}
        onAddStatus={onAddStatus}
      />,
    )

    expect(screen.queryByText('No statuses yet.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add status/i })).not.toBeInTheDocument()
    expect(screen.getByText('Intake')).toBeInTheDocument()
  })
})

describe('CreateStatusModal', () => {
  it('validates input and calls createStatus on submit', async () => {
    const createdStatus: AnimalStatus = {
      id: 'status-new',
      org_id: 'org-123',
      label: 'Quarantine',
      sort_order: 2,
      counts_as_in_care: 1,
      archived: 0,
      created_at: '2026-10-04T00:00:00Z',
    }

    const createSpy = vi
      .spyOn(statusesModule, 'createStatus')
      .mockResolvedValue(createdStatus)

    const onClose = vi.fn()
    const onCreated = vi.fn()

    render(
      <CreateStatusModal
        orgId="org-123"
        onClose={onClose}
        onCreated={onCreated}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Add status' })).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Add status' })
    const input = screen.getByPlaceholderText(/e\.g\. Intake, Foster, Medical/i)

    // Type status name
    fireEvent.change(input, { target: { value: 'Quarantine' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orgId: 'org-123',
          label: 'Quarantine',
          countsAsInCare: true,
        }),
      )
      expect(onCreated).toHaveBeenCalledWith(createdStatus)
      expect(onClose).toHaveBeenCalled()
    })

    createSpy.mockRestore()
  })

  it('closes on Escape key press or Cancel button click', () => {
    const onClose = vi.fn()
    render(
      <CreateStatusModal
        orgId="org-123"
        onClose={onClose}
        onCreated={vi.fn()}
      />,
    )

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('CreateCategoryModal', () => {
  it('validates input and calls createLedgerCategory on submit', async () => {
    const createdCat = {
      id: 'cat-new',
      org_id: 'org-123',
      label: 'Medical Supplies',
      direction: 'out' as const,
      archived: 0,
      created_at: new Date().toISOString(),
    }

    const createSpy = vi
      .spyOn(ledgerModule, 'createLedgerCategory')
      .mockResolvedValue(createdCat)

    const onClose = vi.fn()
    const onCreated = vi.fn()

    render(
      <CreateCategoryModal
        orgId="org-123"
        onClose={onClose}
        onCreated={onCreated}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Add category' })).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Add category' })
    const input = screen.getByPlaceholderText(/e\.g\. Veterinary, Food, Donation/i)

    fireEvent.change(input, { target: { value: 'Medical Supplies' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orgId: 'org-123',
          label: 'Medical Supplies',
          direction: 'out',
        }),
      )
      expect(onCreated).toHaveBeenCalledWith(createdCat)
      expect(onClose).toHaveBeenCalled()
    })

    createSpy.mockRestore()
  })
})
