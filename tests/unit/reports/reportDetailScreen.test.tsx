import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReportDetailScreen } from '@/features/reports/screens/ReportDetailScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'

const mockDb = {
  getAll: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  execute: vi.fn().mockResolvedValue({}),
}

vi.mock('@/shared/hooks/useDb', () => ({ useDb: () => mockDb }))
vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'PARC' },
  }),
}))
vi.mock('@/features/animals/domain/animals', () => ({
  createAnimal: vi.fn().mockResolvedValue({ id: 'mock-animal-1', shelter_code: 'PARC-101' }),
}))
vi.mock('@/features/statuses/domain/statuses', () => ({
  listStatuses: vi.fn().mockResolvedValue([
    { id: 'stat-intake', label: 'Intake', counts_as_in_care: 1, archived: 0 },
    { id: 'stat-released', label: 'Released', counts_as_in_care: 0, archived: 0 },
  ]),
}))
vi.mock('@/features/animals/domain/relationships', () => ({
  linkAnimals: vi.fn().mockResolvedValue(undefined),
}))

describe('ReportDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders report ID, status badge, pipeline, facts grid, and stage action button', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      category: 'emergency',
      species: 'dog',
      chief_complaint: 'Hit by rickshaw • Fracture',
      status: 'logged',
      location_area: 'Burns Road',
      location_landmark: 'Near Fresco',
      reporter_name: 'Usman',
      reporter_phone: '0300-1234567',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: null,
      stage_dispatched_at: null,
      stage_attended_at: null,
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R105')).toBeInTheDocument()
    expect(screen.getByText(/New Report \(Awaiting Decision\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accept & Triage/i })).toBeInTheDocument()
    expect(screen.getByText('Burns Road')).toBeInTheDocument()
    expect(screen.getByText('Near Fresco')).toBeInTheDocument()
    expect(screen.getByText('Usman')).toBeInTheDocument()
    expect(screen.getByText('0300 1234567')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Call/i })).toHaveAttribute('href', 'tel:0300-1234567')

    // Pipeline steps
    expect(screen.getByText('Report Logged')).toBeInTheDocument()
    expect(screen.getByText('Triage Decision')).toBeInTheDocument()
    expect(screen.getByText('Field & Transport')).toBeInTheDocument()
    expect(screen.getByText('Animal Attended')).toBeInTheDocument()
  })

  it('progresses stage from logged to accepted when Accept & Triage is clicked', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      category: 'emergency',
      species: 'dog',
      chief_complaint: 'Fracture',
      status: 'logged',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const acceptBtn = await screen.findByRole('button', { name: /Accept & Triage/i })
    fireEvent.click(acceptBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'accepted')
    })
  })

  it('cancels/declines report via dropdown option at logged stage', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      category: 'emergency',
      species: 'dog',
      chief_complaint: 'Fracture',
      status: 'logged',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const toggleBtn = await screen.findByRole('button', { name: /More stage actions/i })
    fireEvent.click(toggleBtn)

    const declineBtn = await screen.findByRole('button', { name: /Decline \/ Cancel Report/i })
    fireEvent.click(declineBtn)

    const reasonInput = screen.getByLabelText(/Reason for cancellation/i)
    fireEvent.change(reasonInput, { target: { value: 'Citizen called back - animal already rescued' } })

    const confirmBtn = screen.getByRole('button', { name: /Decline Report/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'cancelled', {
        dismissalReason: 'Citizen called back - animal already rescued',
      })
    })
  })

  it('progresses stage from accepted to dispatched when Dispatch Ambulance is clicked', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'accepted',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T14:20:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const dispatchBtn = await screen.findByRole('button', { name: /Dispatch Ambulance/i })
    fireEvent.click(dispatchBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'dispatched', 'ambulance')
    })
  })

  it('progresses stage from accepted to dispatched with reporter transport', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'accepted',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T14:20:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const toggleBtn = await screen.findByRole('button', { name: /More stage actions/i })
    fireEvent.click(toggleBtn)

    const reporterBtn = await screen.findByRole('button', { name: /Reporter Arranging Transport/i })
    fireEvent.click(reporterBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'dispatched', 'reporter')
    })
  })

  it('allows moving back one stage from accepted to logged via dropdown', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'accepted',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T14:20:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const toggleBtn = await screen.findByRole('button', { name: /More stage actions/i })
    fireEvent.click(toggleBtn)

    const backBtn = await screen.findByRole('button', { name: /Change decision/i })
    fireEvent.click(backBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'logged')
    })
  })

  it('progresses stage from dispatched to attended and creates animal record automatically', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'dispatched',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T14:20:00Z',
      stage_dispatched_at: '2026-10-13T14:35:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const completeSpy = vi.spyOn(domainModule, 'completeReportWithDisposition').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const attendedBtn = await screen.findByRole('button', { name: /Mark Attended/i })
    fireEvent.click(attendedBtn)

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(
        expect.anything(),
        'rep-1',
        'admitted_shelter',
        'mock-animal-1',
      )
    })
  })

  it('renders Open Profile link when status is attended and animal exists, without showing interlink banner on repeat view', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'mock-animal-1',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T14:20:00Z',
      stage_dispatched_at: '2026-10-13T14:35:00Z',
      stage_attended_at: '2026-10-13T14:50:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const profileLink = await screen.findByRole('link', { name: /Open Profile/i })
    expect(profileLink).toHaveAttribute('href', '/animals/mock-animal-1')

    // Animal banner does not render on repeat visits (only once immediately upon creation)
    expect(
      screen.queryByText(/Permanent animal record created/i),
    ).not.toBeInTheDocument()
  })

  it('allows moving back one stage from attended to dispatched via dropdown', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'attended',
      animal_id: 'mock-animal-1',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const toggleBtn = await screen.findByRole('button', { name: /More stage actions/i })
    fireEvent.click(toggleBtn)

    const backBtn = await screen.findByRole('button', { name: /Change decision/i })
    fireEvent.click(backBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'dispatched')
    })
  })

  it('renders cruelty 4-step pipeline and dedicated action buttons for cruelty category', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-c1',
      org_id: 'org-1',
      report_number: 'PARC-R201',
      category: 'cruelty',
      species: 'dog',
      chief_complaint: 'Chained continuously without water',
      status: 'logged',
      location_area: 'Gulshan',
      location_landmark: 'Block 4',
      stage_logged_at: '2026-10-13T14:10:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    render(
      <MemoryRouter initialEntries={['/reports/rep-c1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R201')).toBeInTheDocument()
    expect(screen.getByText(/New Complaint \(Awaiting Investigation\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Begin Investigation/i })).toBeInTheDocument()

    // 4-step cruelty pipeline titles
    expect(screen.getByText('Complaint Logged')).toBeInTheDocument()
    expect(screen.getByText('Investigation')).toBeInTheDocument()
    expect(screen.getByText('Notice / Legal Action')).toBeInTheDocument()
    expect(screen.getByText('Custody / Resolution')).toBeInTheDocument()
    expect(screen.getByText('Incident & Animal')).toBeInTheDocument()
  })

  it('supports transitioning cruelty complaint to notice/action and taking into custody', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-c2',
      org_id: 'org-1',
      report_number: 'PARC-R202',
      category: 'cruelty',
      species: 'horse',
      chief_complaint: 'Severe beating by cart owner',
      status: 'accepted',
      location_area: 'Saddar',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T15:00:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-c2']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Under Investigation/i)).toBeInTheDocument()
    const actionBtn = screen.getByRole('button', { name: /Log Notice \/ Legal Action/i })
    fireEvent.click(actionBtn)

    const notesInput = screen.getByLabelText(/Legal action details/i)
    fireEvent.change(notesInput, { target: { value: 'FIR #402/26 filed at Saddar PS' } })

    const proceedBtn = screen.getByRole('button', { name: /Record & Proceed/i })
    fireEvent.click(proceedBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-c2', 'dispatched', {
        legalNotes: 'FIR #402/26 filed at Saddar PS',
      })
    })
  })

  it('enforces mandatory legal notes and opens modal when clicking pipeline step 3', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-c3',
      org_id: 'org-1',
      report_number: 'PARC-R203',
      category: 'cruelty',
      species: 'dog',
      chief_complaint: 'Starvation',
      status: 'accepted',
      location_area: 'Clifton',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T15:00:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-c3']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R203')).toBeInTheDocument()

    // Click step 3 "Notice / Legal Action" in the stepper
    const step3 = screen.getByText('Notice / Legal Action')
    fireEvent.click(step3)

    // Modal should be open
    expect(screen.getByRole('heading', { name: /Log Notice \/ Legal Action/i })).toBeInTheDocument()

    // Submitting without entering text shows error
    const proceedBtn = screen.getByRole('button', { name: /Record & Proceed/i })
    fireEvent.click(proceedBtn)

    expect(
      screen.getByText('Legal action details are mandatory to move to this stage.'),
    ).toBeInTheDocument()
    expect(updateStageSpy).not.toHaveBeenCalled()

    // Fill notes and submit
    const notesInput = screen.getByLabelText(/Legal action details/i)
    fireEvent.change(notesInput, { target: { value: 'Written warning issued' } })
    fireEvent.click(proceedBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-c3', 'dispatched', {
        legalNotes: 'Written warning issued',
      })
    })
  })

  it('renders Legal Action & Notice and Dismissal Reason cards in ReportFactsGrid', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-c4',
      org_id: 'org-1',
      report_number: 'PARC-R204',
      category: 'cruelty',
      species: 'dog',
      chief_complaint: 'Abandonment',
      status: 'cancelled',
      legal_notes: 'FIR 109 filed at police station',
      dismissal_reason: 'Citizen resolved dispute on-site amicably',
      location_area: 'Gulberg',
      stage_logged_at: '2026-10-13T14:10:00Z',
      created_at: '2026-10-13T14:10:00Z',
    } as any)

    render(
      <MemoryRouter initialEntries={['/reports/rep-c4']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R204')).toBeInTheDocument()

    // Legal notes card
    expect(screen.getByText('Legal Action & Notice')).toBeInTheDocument()
    expect(screen.getByText('FIR 109 filed at police station')).toBeInTheDocument()

    // Dismissal reason card
    expect(screen.getByText('Dismissal Reason')).toBeInTheDocument()
    expect(screen.getByText('Citizen resolved dispute on-site amicably')).toBeInTheDocument()
  })

  it('displays pinned coordinates with free Navigate link in facts grid', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-nav',
      org_id: 'org-1',
      report_number: 'PARC-R108',
      category: 'emergency',
      species: 'cat',
      chief_complaint: 'Trapped in drain',
      status: 'accepted',
      location_area: 'Gulshan-e-Iqbal Block 6',
      location_landmark: 'Near Disco Bakery',
      latitude: 24.918,
      longitude: 67.0971,
      reporter_name: 'Farhan',
      reporter_phone: '0333-1234567',
      stage_logged_at: '2026-10-22T14:10:00Z',
      stage_accepted_at: '2026-10-22T14:20:00Z',
      created_at: '2026-10-22T14:10:00Z',
    } as any)

    render(
      <MemoryRouter initialEntries={['/reports/rep-nav']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R108')).toBeInTheDocument()
    expect(screen.getByText(/24.9180° N, 67.0971° E/i)).toBeInTheDocument()
    const navLink = screen.getByRole('link', { name: /Navigate/i })
    expect(navLink).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=24.918,67.0971',
    )
  })

  it('supports marking report DOA (Dead on Arrival) from dispatched stage without creating animal record', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-doa',
      org_id: 'org-1',
      report_number: 'PARC-R109',
      category: 'emergency',
      species: 'dog',
      chief_complaint: 'Severe trauma',
      status: 'dispatched',
      location_area: 'Thokar Niaz Baig',
      stage_logged_at: '2026-10-22T14:10:00Z',
      stage_accepted_at: '2026-10-22T14:20:00Z',
      stage_dispatched_at: '2026-10-22T14:30:00Z',
      created_at: '2026-10-22T14:10:00Z',
    } as any)

    const completeSpy = vi.spyOn(domainModule, 'completeReportWithDisposition').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reports/rep-doa']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R109')).toBeInTheDocument()

    // Open top dropdown
    fireEvent.click(screen.getByRole('button', { name: /More stage actions/i }))

    // Click "Dead on Arrival"
    const doaBtn = screen.getByRole('button', { name: /^Dead on Arrival$/i })
    expect(doaBtn).toBeInTheDocument()
    fireEvent.click(doaBtn)

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(
        expect.anything(),
        'rep-doa',
        'deceased_doa',
      )
    })
  })

  it('renders Dead on Arrival (DOA) badge when disposition is deceased_doa', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-doa-done',
      org_id: 'org-1',
      report_number: 'PARC-R110',
      category: 'emergency',
      species: 'dog',
      chief_complaint: 'Pronounced dead',
      status: 'attended',
      disposition_type: 'deceased_doa',
      location_area: 'Niaz Baig',
      animal_id: null,
      stage_logged_at: '2026-10-22T14:10:00Z',
      stage_attended_at: '2026-10-22T15:00:00Z',
      created_at: '2026-10-22T14:10:00Z',
    } as any)

    render(
      <MemoryRouter initialEntries={['/reports/rep-doa-done']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R110')).toBeInTheDocument()
    expect(screen.getAllByText(/Dead on Arrival \(DOA\)/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Dead on Arrival/i })).toBeInTheDocument()
  })
})
