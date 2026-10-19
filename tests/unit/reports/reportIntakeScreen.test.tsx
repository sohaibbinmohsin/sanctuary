import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ReportIntakeScreen } from '@/features/reports/screens/ReportIntakeScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'

vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => ({}) }))
vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'PARC' },
  }),
}))

describe('ReportIntakeScreen', () => {
  it('renders full-screen report intake and creates a report', async () => {
    vi.spyOn(domainModule, 'generateReportNumber').mockResolvedValue('PARC-R101')
    const createReportSpy = vi.spyOn(domainModule, 'createRescueReport').mockResolvedValue({
      id: 'rep-new',
      org_id: 'org-1',
      report_number: 'PARC-R101',
      species: 'cat',
      chief_complaint: 'Injured tail',
      location_area: 'Burns Road',
      status: 'logged',
    } as any)

    render(
      <MemoryRouter>
        <ReportIntakeScreen />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /Log a rescue report/i })).toBeInTheDocument()

    // Select Cat species
    fireEvent.click(screen.getByRole('button', { name: 'Cat' }))

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Injured tail' },
    })
    fireEvent.change(screen.getByLabelText(/Location area/i), {
      target: { value: 'Burns Road' },
    })
    fireEvent.change(screen.getByLabelText(/Landmark/i), {
      target: { value: 'Near Fresco Sweets' },
    })
    fireEvent.change(screen.getByLabelText(/Reporter name/i), {
      target: { value: 'Kamran' },
    })
    fireEvent.change(screen.getByLabelText(/Reporter phone/i), {
      target: { value: '0300-1122334' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Log rescue report/i }))

    await waitFor(() => {
      expect(createReportSpy).toHaveBeenCalledWith(expect.anything(), {
        orgId: 'org-1',
        reportNumber: 'PARC-R101',
        category: 'emergency',
        species: 'cat',
        chiefComplaint: 'Injured tail',
        locationArea: 'Burns Road',
        locationLandmark: 'Near Fresco Sweets',
        reporterName: 'Kamran',
        reporterPhone: '0300-1122334',
      })
    })
  })
})
