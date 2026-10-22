import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ReportIntakeScreen } from '@/features/reports/screens/ReportIntakeScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'

vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => ({ execute: vi.fn(), getAll: vi.fn() }) }))
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

    // Verify Welfare check is NOT present in category options
    expect(screen.queryByRole('button', { name: /Welfare check/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Medical emergency/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Animal cruelty/i })).toBeInTheDocument()

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
      target: { value: '03001122334' },
    })

    // Expect formatted phone and valid phone indicator
    expect(screen.getByDisplayValue('0300-1122334')).toBeInTheDocument()
    expect(screen.getByText(/Valid phone number/i)).toBeInTheDocument()

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
        reporterCnic: null,
      })
    })
  })

  it('supports edit mode to modify report details without altering stage timeline', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-existing',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      category: 'emergency',
      species: 'dog',
      chief_complaint: 'Fractured leg',
      location_area: 'Saddar',
      location_landmark: 'Near Empress Market',
      reporter_name: 'Usman',
      reporter_phone: '0300-1234567',
      status: 'dispatched',
      stage_logged_at: '2026-10-13T10:00:00Z',
      stage_accepted_at: '2026-10-13T10:15:00Z',
      stage_dispatched_at: '2026-10-13T10:30:00Z',
      stage_attended_at: null,
    } as any)
    vi.spyOn(domainModule, 'getPhotosForReport').mockResolvedValue([])

    const updateReportSpy = vi.spyOn(domainModule, 'updateRescueReport').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-existing/edit']}>
        <Routes>
          <Route path="/reports/:id/edit" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    // Heading for edit mode
    expect(await screen.findByRole('heading', { name: /Edit Report PARC-R105/i })).toBeInTheDocument()

    // Form fields are populated with existing data
    expect(screen.getByDisplayValue('Fractured leg')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Saddar')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Near Empress Market')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Usman')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0300-1234567')).toBeInTheDocument()

    // Update chief complaint
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Fractured rear leg • Splint needed' },
    })

    // Submit save changes
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(updateReportSpy).toHaveBeenCalledWith(expect.anything(), 'rep-existing', {
        category: 'emergency',
        species: 'dog',
        chiefComplaint: 'Fractured rear leg • Splint needed',
        locationArea: 'Saddar',
        locationLandmark: 'Near Empress Market',
        reporterName: 'Usman',
        reporterPhone: '0300-1234567',
        reporterCnic: null,
        legalNotes: null,
      })
    })
  })

  it('renders extra Legal Action & Notice card in edit mode for cruelty reports and handles CNIC', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-c10',
      org_id: 'org-1',
      report_number: 'PARC-R210',
      category: 'cruelty',
      species: 'horse',
      chief_complaint: 'Overworking',
      location_area: 'Tower',
      location_landmark: 'Near bus stop',
      reporter_name: 'Bilal',
      reporter_phone: '0300-9876543',
      reporter_cnic: '42101-1234567-1',
      legal_notes: 'Initial FIR #12 filed',
      status: 'dispatched',
      created_at: '2026-10-22T10:00:00Z',
    } as any)
    vi.spyOn(domainModule, 'getPhotosForReport').mockResolvedValue([])

    const updateReportSpy = vi.spyOn(domainModule, 'updateRescueReport').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-c10/edit']}>
        <Routes>
          <Route path="/reports/:id/edit" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /Edit Report PARC-R210/i })).toBeInTheDocument()

    // CNIC should be populated
    expect(screen.getByDisplayValue('42101-1234567-1')).toBeInTheDocument()
    expect(screen.getByText(/Valid 13-digit CNIC/i)).toBeInTheDocument()

    // Extra card "Legal Action & Notice" should be visible
    expect(screen.getByText('Legal Action & Notice')).toBeInTheDocument()
    const legalField = screen.getByDisplayValue('Initial FIR #12 filed')
    expect(legalField).toBeInTheDocument()

    // Edit legal action
    fireEvent.change(legalField, {
      target: { value: 'Updated FIR #12/26 with section 428 IPC' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(updateReportSpy).toHaveBeenCalledWith(expect.anything(), 'rep-c10', {
        category: 'cruelty',
        species: 'horse',
        chiefComplaint: 'Overworking',
        locationArea: 'Tower',
        locationLandmark: 'Near bus stop',
        reporterName: 'Bilal',
        reporterPhone: '0300-9876543',
        reporterCnic: '42101-1234567-1',
        legalNotes: 'Updated FIR #12/26 with section 428 IPC',
      })
    })
  })
})
