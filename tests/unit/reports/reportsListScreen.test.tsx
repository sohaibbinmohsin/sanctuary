import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ReportsListScreen } from '@/features/reports/screens/ReportsListScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'

vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => ({}) }))
vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'PARC' },
  }),
}))

describe('ReportsListScreen', () => {
  it('renders timeline grouped reports and header button', async () => {
    vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([
      {
        id: 'rep-1',
        org_id: 'org-1',
        report_number: 'PARC-R105',
        category: 'emergency',
        species: 'dog',
        chief_complaint: 'Hit by rickshaw • Fractured leg',
        status: 'logged',
        location_area: 'Burns Road',
        location_landmark: 'Near Fresco',
        reporter_name: 'Usman',
        reporter_phone: '0300-1234567',
        created_at: new Date().toISOString(),
      } as any,
    ])

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R105')).toBeInTheDocument()
    expect(screen.getByText('DOG')).toBeInTheDocument()
    expect(screen.getByText(/Hit by rickshaw/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ Log report/i })).toBeInTheDocument()
  })

  it('filters reports when filter chips are clicked', async () => {
    const getRescueReportsSpy = vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([])

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    const inProgressChip = screen.getByRole('button', { name: 'In progress' })
    fireEvent.click(inProgressChip)

    await waitFor(() => {
      expect(getRescueReportsSpy).toHaveBeenCalledWith(expect.anything(), 'org-1', 'in_progress')
    })
  })

  it('opens LogReportModal and logs new report', async () => {
    vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([])
    vi.spyOn(domainModule, 'generateReportNumber').mockResolvedValue('PARC-R106')
    const createReportSpy = vi.spyOn(domainModule, 'createRescueReport').mockResolvedValue({
      id: 'rep-2',
      org_id: 'org-1',
      report_number: 'PARC-R106',
      species: 'cat',
      chief_complaint: 'Stuck in engine',
      location_area: 'Clifton',
      status: 'logged',
      created_at: new Date().toISOString(),
    } as any)

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /\+ Log report/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Log incoming rescue report/i })).toBeInTheDocument()

    // Select Cat species
    fireEvent.click(screen.getByRole('button', { name: 'Cat' }))

    // Fill form
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Stuck in engine' },
    })
    fireEvent.change(screen.getByLabelText(/Location area/i), {
      target: { value: 'Clifton Block 4' },
    })
    fireEvent.change(screen.getByLabelText(/Landmark/i), {
      target: { value: 'Near Boat Basin' },
    })
    fireEvent.change(screen.getByLabelText(/Reporter name/i), {
      target: { value: 'Ahmed' },
    })
    fireEvent.change(screen.getByLabelText(/Reporter phone/i), {
      target: { value: '0321-9876543' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Log rescue report/i }))

    await waitFor(() => {
      expect(createReportSpy).toHaveBeenCalledWith(expect.anything(), {
        orgId: 'org-1',
        reportNumber: 'PARC-R106',
        species: 'cat',
        chiefComplaint: 'Stuck in engine',
        locationArea: 'Clifton Block 4',
        locationLandmark: 'Near Boat Basin',
        reporterName: 'Ahmed',
        reporterPhone: '0321-9876543',
      })
    })
  })
})
