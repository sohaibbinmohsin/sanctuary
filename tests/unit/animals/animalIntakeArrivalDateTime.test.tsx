import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalIntakeScreen } from '@/features/animals/screens/AnimalIntakeScreen'
import * as animalsDomain from '@/features/animals/domain/animals'
import * as statusesDomain from '@/features/statuses/domain/statuses'
import * as currentMemberHook from '@/shared/hooks/useCurrentMember'
import * as dbHook from '@/shared/hooks/useDb'

vi.mock('@/features/animals/domain/animals', () => ({
  createAnimal: vi.fn(),
  getAnimal: vi.fn(),
  updateAnimal: vi.fn(),
  archiveAnimal: vi.fn(),
}))

vi.mock('@/features/photos/domain/photos', () => ({
  queuePhoto: vi.fn(),
  processPhotoQueue: vi.fn(),
  deletePhotosForAnimal: vi.fn(),
}))

vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(true)),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('AnimalIntakeScreen Arrival Date & Time and No Status Selection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(dbHook, 'useDb').mockReturnValue({} as any)
    vi.spyOn(currentMemberHook, 'useCurrentMember').mockReturnValue({
      member: {
        id: 'member-1',
        orgId: 'org-test',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Test Org',
        orgInitials: 'TO',
      },
      loading: false,
    } as any)

    vi.spyOn(statusesDomain, 'listStatuses').mockResolvedValue([
      {
        id: 'status-intake',
        org_id: 'org-test',
        label: 'Intake',
        sort_order: 1,
        counts_as_in_care: 1,
      },
      {
        id: 'status-quarantine',
        org_id: 'org-test',
        label: 'Quarantine',
        sort_order: 2,
        counts_as_in_care: 1,
      },
    ] as any)
  })

  it('renders date and time arrived fields with defaults and does NOT render status selection', async () => {
    vi.spyOn(animalsDomain, 'createAnimal').mockResolvedValue({
      id: 'anim-created',
      shelter_code: 'TO-0001',
      org_id: 'org-test',
      species: 'Dog',
      status_id: 'status-intake',
      name: 'Max',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      intake_date: '2026-10-08',
      archived: 0,
    } as any)

    render(
      <MemoryRouter initialEntries={['/animals/new']}>
        <AnimalIntakeScreen />
      </MemoryRouter>
    )

    // Status selection pills should NOT be present on add animal screen
    expect(screen.queryByRole('group', { name: /status/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Quarantine')).not.toBeInTheDocument()

    // Date arrived and Time arrived inputs should exist with default values
    const dateInput = screen.getByLabelText(/date arrived/i) as HTMLInputElement
    const timeInput = screen.getByLabelText(/time arrived/i) as HTMLInputElement
    expect(dateInput).toBeInTheDocument()
    expect(timeInput).toBeInTheDocument()
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(timeInput.value).toMatch(/^\d{2}:\d{2}$/)

    // Changing date and time
    fireEvent.change(dateInput, { target: { value: '2026-10-05' } })
    fireEvent.change(timeInput, { target: { value: '14:30' } })

    // Name
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Max' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save animal/i }))

    await waitFor(() => {
      expect(animalsDomain.createAnimal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          species: 'Dog',
          statusIds: ['status-intake'],
          name: 'Max',
          intakeDate: '2026-10-05',
          intakeTime: '14:30',
        })
      )
    })
  })
})
