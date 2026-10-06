import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

beforeEach(() => {
  if (typeof globalThis.caches === 'undefined') {
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(false),
        keys: vi.fn().mockResolvedValue([]),
      }),
    })
  }
})

const mockExecute = vi.fn().mockResolvedValue(undefined)
const mockWriteTx = vi.fn().mockImplementation(async (cb) => cb({ execute: mockExecute }))
const mockGetOptional = vi.fn().mockResolvedValue({
  id: 'anim-1',
  org_id: 'org-1',
  shelter_code: 'MS-0001',
  name: 'Barnaby',
  species: 'Dog',
  intake_date: '2026-10-06',
  status_id: 'st-1',
  status_label: 'Intake',
  status_labels: ['Intake'],
  archived: 0,
  created_at: '2026-10-06T00:00:00Z',
  updated_at: '2026-10-06T00:00:00Z',
})
const mockGetAll = vi.fn().mockResolvedValue([
  { id: 'st-1', org_id: 'org-1', label: 'Intake', sort_order: 1, counts_as_in_care: 1, archived: 0, created_at: '', updated_at: '' },
  { id: 'st-2', org_id: 'org-1', label: 'Quarantine', sort_order: 2, counts_as_in_care: 1, archived: 0, created_at: '', updated_at: '' },
])

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getOptional: mockGetOptional,
    getAll: mockGetAll,
    execute: mockExecute,
    writeTransaction: mockWriteTx,
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'MS', orgName: 'Main Shelter', role: 'admin' },
    loading: false,
  }),
}))

describe('AnimalDetailScreen status moved inside Timeline tab', () => {
  it('does not render status pills in profile header; renders Update status button in Timeline tab that opens modal', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    // Header should NOT have status pills group
    expect(screen.queryByRole('group', { name: /Animal status/i })).toBeNull()

    // Switch to Timeline tab
    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    fireEvent.click(timelineTab)

    // Button to update status exists
    const updateBtn = await screen.findByRole('button', { name: /Update status/i })
    expect(updateBtn).toBeInTheDocument()

    fireEvent.click(updateBtn)

    // Modal opens with status form
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Update status/i })).toBeInTheDocument()
  })

  it('submits status update form and saves status assignment and treatment record', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    // Switch to Timeline tab
    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    fireEvent.click(timelineTab)

    const updateBtn = await screen.findByRole('button', { name: /Update status/i })
    fireEvent.click(updateBtn)

    // Inside modal, choose Quarantine status
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const quarantinePill = await screen.findByRole('button', { name: /Quarantine/i })
    fireEvent.click(quarantinePill)

    // Enter notes
    const notesInput = screen.getByLabelText(/Notes/i)
    fireEvent.change(notesInput, { target: { value: 'Moved to quarantine wing' } })

    // Save status
    const saveBtn = screen.getByRole('button', { name: /Save status/i })
    fireEvent.click(saveBtn)

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // Status assignment write transaction was called
    expect(mockWriteTx).toHaveBeenCalled()
    // Treatment entry was executed
    expect(mockExecute).toHaveBeenCalled()
  })
})
