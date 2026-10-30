import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

const mockExecute = vi.fn().mockResolvedValue(undefined)
const mockQueuePhoto = vi.fn().mockResolvedValue({ id: 'photo-1', created_at: '2026-10-30T00:00:00Z' })

vi.mock('@/features/photos/domain/photos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/photos/domain/photos')>()
  return {
    ...actual,
    queuePhoto: (...args: any[]) => mockQueuePhoto(...args),
  }
})

beforeEach(() => {
  mockExecute.mockClear()
  mockQueuePhoto.mockClear()
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
const mockGetAll = vi.fn().mockImplementation(async (sql: string) => {
  if (sql.includes('treatments')) {
    return [
      {
        id: 'treat-1',
        org_id: 'org-1',
        animal_id: 'anim-1',
        treatment_type: 'status',
        notes: 'Under Treatment - Clinic: UVAS Small Animal Hospital [uvas-small-animal-hospital]\nPatient is doing well',
        treated_at: '2026-10-07T12:00:00Z',
        created_at: '2026-10-07T12:00:00Z',
      },
    ]
  }
  return [
    { id: 'st-1', org_id: 'org-1', label: 'Intake', sort_order: 1, counts_as_in_care: 1, archived: 0, created_at: '', updated_at: '' },
    { id: 'st-2', org_id: 'org-1', label: 'Quarantine', sort_order: 2, counts_as_in_care: 1, archived: 0, created_at: '', updated_at: '' },
  ]
})

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

    // Status assignment and treatment records were executed
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE animals SET status_id = ?'),
      expect.arrayContaining(['st-2', 'anim-1']),
    )
  })

  it('hides unique id slugs from timeline notes on the frontend', async () => {
    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    // Switch to Timeline tab
    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    fireEvent.click(timelineTab)

    // Clinic name should be visible
    expect(await screen.findByText(/Clinic: UVAS Small Animal Hospital/i)).toBeInTheDocument()
    // Slug should NOT be visible on frontend
    expect(screen.queryByText(/uvas-small-animal-hospital/i)).toBeNull()
  })

  it('allows attaching a photo in the status update modal via photo picker menu', async () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-status-photo')
    global.URL.revokeObjectURL = vi.fn()

    render(
      <MemoryRouter initialEntries={['/animals/anim-1']}>
        <Routes>
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    // Switch to Timeline tab and open status modal
    const timelineTab = await screen.findByRole('tab', { name: /Timeline/i })
    fireEvent.click(timelineTab)

    const updateBtn = await screen.findByRole('button', { name: /Update status/i })
    fireEvent.click(updateBtn)

    const modal = screen.getByRole('dialog')
    expect(modal).toBeInTheDocument()

    // Find and click the Add photo (+) button inside the modal
    const addPhotoBtn = within(modal).getByRole('button', { name: 'Add photo' })
    expect(addPhotoBtn).toBeInTheDocument()
    fireEvent.click(addPhotoBtn)

    // Verify photo menu opens with both options
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /take photo/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /from gallery/i })).toBeInTheDocument()

    // Find the gallery file input within modal and upload a photo
    const fileInputs = modal.querySelectorAll('input[type="file"]')
    const galleryInput = Array.from(fileInputs).find(
      (input) => !input.hasAttribute('capture'),
    ) as HTMLInputElement
    expect(galleryInput).toBeTruthy()

    const testFile = new File(['status-test'], 'status.jpg', { type: 'image/jpeg' })
    fireEvent.change(galleryInput, { target: { files: [testFile] } })

    // Verify preview thumbnail is rendered in the modal
    expect(await screen.findByLabelText('Photo preview')).toBeInTheDocument()

    // Select status and submit
    const quarantinePill = await screen.findByRole('button', { name: /Quarantine/i })
    fireEvent.click(quarantinePill)

    const saveBtn = screen.getByRole('button', { name: /Save status/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // Verify photo was queued for the animal
    expect(mockQueuePhoto).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-1',
        animalId: 'anim-1',
        captureSource: 'gallery',
      }),
    )
  })
})
