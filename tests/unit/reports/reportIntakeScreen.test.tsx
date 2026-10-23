import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ReportIntakeScreen } from '@/features/reports/screens/ReportIntakeScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'

const mockDb = { execute: vi.fn(), getAll: vi.fn().mockResolvedValue([]) }
vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => mockDb }))
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

    // Verify Life stage buttons are present and select Child
    expect(screen.getByRole('button', { name: 'Adult' })).toBeInTheDocument()
    const childBtn = screen.getByRole('button', { name: 'Child' })
    expect(childBtn).toBeInTheDocument()
    fireEvent.click(childBtn)

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Injured tail' },
    })
    fireEvent.change(screen.getByLabelText(/City/i), {
      target: { value: 'Lahore' },
    })
    fireEvent.change(screen.getByLabelText(/Area \/ Neighborhood/i), {
      target: { value: 'Gulberg III' },
    })
    fireEvent.change(screen.getByLabelText(/Landmark/i), {
      target: { value: 'Near Main Market' },
    })
    fireEvent.change(screen.getByLabelText(/^Name/i), {
      target: { value: 'Kamran' },
    })
    fireEvent.change(screen.getByLabelText(/^Phone/i), {
      target: { value: '03001122334' },
    })

    // Expect formatted phone and valid phone indicator
    expect(screen.getByDisplayValue('0300 1122334')).toBeInTheDocument()
    expect(screen.getByText(/Valid phone number/i)).toBeInTheDocument()

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Log rescue report/i }))

    await waitFor(() => {
      expect(createReportSpy).toHaveBeenCalledWith(expect.anything(), {
        orgId: 'org-1',
        reportNumber: 'PARC-R101',
        category: 'emergency',
        species: 'cat',
        lifeStage: 'child',
        chiefComplaint: 'Injured tail',
        city: 'Lahore',
        locationArea: 'Gulberg III',
        locationLandmark: 'Near Main Market',
        latitude: null,
        longitude: null,
        reporterName: 'Kamran',
        reporterPhone: '0300 1122334',
        reporterCnic: null,
        intakeSource: 'citizen',
        animalCount: 1,
        groupBreakdown: null,
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
      life_stage: 'adult',
      chief_complaint: 'Fractured leg',
      city: 'Karachi',
      location_area: 'Saddar',
      location_landmark: 'Near Empress Market',
      latitude: null,
      longitude: null,
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
    expect(screen.getByDisplayValue('Karachi')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Saddar')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Near Empress Market')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Usman')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0300 1234567')).toBeInTheDocument()

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
        lifeStage: 'adult',
        chiefComplaint: 'Fractured rear leg • Splint needed',
        city: 'Karachi',
        locationArea: 'Saddar',
        locationLandmark: 'Near Empress Market',
        latitude: null,
        longitude: null,
        reporterName: 'Usman',
        reporterPhone: '0300 1234567',
        reporterCnic: null,
        legalNotes: null,
        intakeSource: 'citizen',
        animalCount: 1,
        groupBreakdown: null,
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
      life_stage: 'adult',
      chief_complaint: 'Overworking',
      city: 'Karachi',
      location_area: 'Tower',
      location_landmark: 'Near bus stop',
      latitude: null,
      longitude: null,
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
        lifeStage: 'adult',
        chiefComplaint: 'Overworking',
        city: 'Karachi',
        locationArea: 'Tower',
        locationLandmark: 'Near bus stop',
        latitude: null,
        longitude: null,
        reporterName: 'Bilal',
        reporterPhone: '0300 9876543',
        reporterCnic: '42101-1234567-1',
        legalNotes: 'Updated FIR #12/26 with section 428 IPC',
        intakeSource: 'citizen',
        animalCount: 1,
        groupBreakdown: null,
      })
    })
  })

  it('supports zero-cost GPS location detection and link pasting in intake', async () => {
    const createReportSpy = vi.spyOn(domainModule, 'createRescueReport').mockResolvedValue({
      id: 'rep-geo',
      org_id: 'org-1',
      report_number: 'PARC-R102',
      category: 'emergency',
      species: 'dog',
      life_stage: 'adult',
      chief_complaint: 'Hit by car',
      city: 'Karachi',
      location_area: 'Clifton Block 4',
      location_landmark: 'Near Boat Basin',
      latitude: 24.8197,
      longitude: 67.0289,
      reporter_name: null,
      reporter_phone: null,
      reporter_cnic: null,
      intake_source: 'citizen',
      animal_count: 1,
      group_breakdown: null,
      status: 'logged',
      transport_type: null,
      disposition_type: null,
      animal_id: null,
      legal_notes: null,
      dismissal_reason: null,
      stage_logged_at: '2026-10-22T10:00:00Z',
      stage_accepted_at: null,
      stage_dispatched_at: null,
      stage_attended_at: null,
      created_at: '2026-10-22T10:00:00Z',
      updated_at: '2026-10-22T10:00:00Z',
    })

    // Mock requestCurrentPosition
    vi.spyOn(domainModule, 'requestCurrentPosition').mockResolvedValue({
      latitude: 24.8197,
      longitude: 67.0289,
    })

    render(
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path="/reports/new" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Hit by car' },
    })
    fireEvent.change(screen.getByLabelText(/Area \/ Neighborhood/i), {
      target: { value: 'Clifton Block 4' },
    })

    // Click "Detect current location"
    const detectBtn = screen.getByRole('button', { name: /Detect current location/i })
    fireEvent.click(detectBtn)

    // Should pin coordinates and show formatted text + preview button
    expect(await screen.findByText(/24.8197° N, 67.0289° E/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Test navigation in Maps/i)).toHaveAttribute(
      'href',
      expect.stringContaining('24.8197,67.0289'),
    )

    // Submit report
    fireEvent.click(screen.getByRole('button', { name: /Log rescue report/i }))

    await waitFor(() => {
      expect(createReportSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          latitude: 24.8197,
          longitude: 67.0289,
          lifeStage: 'adult',
        }),
      )
    })
  })

  it('supports avian presets under Bird and multi-animal litter count', async () => {
    vi.spyOn(domainModule, 'generateReportNumber').mockResolvedValue('PARC-R103')
    const createReportSpy = vi.spyOn(domainModule, 'createRescueReport').mockResolvedValue({
      id: 'rep-avian',
      org_id: 'org-1',
      report_number: 'PARC-R103',
      species: 'black kite',
      animal_count: 4,
    } as any)

    render(
      <MemoryRouter>
        <ReportIntakeScreen />
      </MemoryRouter>,
    )

    // Select Litter / Family mode
    fireEvent.click(screen.getByRole('button', { name: 'Litter / Family' }))

    // Select Bird species
    fireEvent.click(screen.getByRole('button', { name: 'Bird' }))

    // Avian presets should appear
    expect(screen.getByText('Avian Sub-type')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Black Kite' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pigeon / Dove' })).toBeInTheDocument()

    // Select Black Kite
    fireEvent.click(screen.getByRole('button', { name: 'Black Kite' }))

    // Set animal count to 4
    const countInput = screen.getByRole('spinbutton', { name: /^Animal count$/i })
    fireEvent.change(countInput, { target: { value: '4' } })
    expect(screen.getByText(/Litter of 4/i)).toBeInTheDocument()

    // Fill required complaint & location
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Fledglings fell from nest' },
    })
    fireEvent.change(screen.getByLabelText(/Area \/ Neighborhood/i), {
      target: { value: 'Model Town' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Log rescue report/i }))

    await waitFor(() => {
      expect(createReportSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          species: 'black kite',
          animalCount: 4,
          locationArea: 'Model Town',
        }),
      )
    })
  })

  it('supports Multiple Animals / Mixed intake mode with multi-species roster', async () => {
    vi.spyOn(domainModule, 'generateReportNumber').mockResolvedValue('PARC-R108')
    const createReportSpy = vi.spyOn(domainModule, 'createRescueReport').mockResolvedValue({
      id: 'rep-multi',
      org_id: 'org-1',
      report_number: 'PARC-R108',
    } as any)

    render(
      <MemoryRouter>
        <ReportIntakeScreen />
      </MemoryRouter>,
    )

    // Select Multiple Animals / Mixed
    fireEvent.click(screen.getByRole('button', { name: 'Multiple Animals / Mixed' }))

    // Expect roster and total animals
    expect(screen.getByText(/Animals in Group \/ Scene/i)).toBeInTheDocument()
    expect(screen.getByText(/Total: 2 animals/i)).toBeInTheDocument()

    // Add another row
    fireEvent.click(screen.getByRole('button', { name: /\+ Add another animal \/ species/i }))
    expect(screen.getByText(/Total: 3 animals/i)).toBeInTheDocument()

    // Fill required complaint & location
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Abandoned animals after eviction' },
    })
    fireEvent.change(screen.getByLabelText(/Area \/ Neighborhood/i), {
      target: { value: 'Ichra' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Log rescue report/i }))

    await waitFor(() => {
      expect(createReportSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          animalCount: 3,
          locationArea: 'Ichra',
          groupBreakdown: expect.stringContaining('dog'),
        }),
      )
    })
  })

  it('supports Rescue 1122 intake source with dynamic labels', async () => {
    vi.spyOn(domainModule, 'generateReportNumber').mockResolvedValue('PARC-R104')
    const createReportSpy = vi.spyOn(domainModule, 'createRescueReport').mockResolvedValue({
      id: 'rep-1122',
      org_id: 'org-1',
      report_number: 'PARC-R104',
      intake_source: 'rescue_1122',
    } as any)

    render(
      <MemoryRouter>
        <ReportIntakeScreen />
      </MemoryRouter>,
    )

    // Select Rescue 1122 intake source
    fireEvent.click(screen.getByRole('button', { name: 'Rescue 1122' }))

    // Expect dynamic labels
    expect(screen.getByLabelText(/Dispatcher \/ Officer Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Contact Phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Incident \/ Case Ref #/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Dispatcher \/ Officer Name/i), {
      target: { value: 'Dispatcher Imran' },
    })
    fireEvent.change(screen.getByLabelText(/Incident \/ Case Ref #/i), {
      target: { value: '1122-LHR-8910' },
    })
    fireEvent.change(screen.getByLabelText(/Chief complaint \/ Injury/i), {
      target: { value: 'Trapped dog in drain' },
    })
    fireEvent.change(screen.getByLabelText(/Area \/ Neighborhood/i), {
      target: { value: 'Thokar Niaz Baig' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Log rescue report/i }))

    await waitFor(() => {
      expect(createReportSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          intakeSource: 'rescue_1122',
          reporterName: 'Dispatcher Imran',
          reporterCnic: '1122-LHR-8910',
        }),
      )
    })
  })
})
