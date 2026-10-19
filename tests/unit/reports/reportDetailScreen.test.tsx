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
    expect(screen.getByText('0300-1234567')).toBeInTheDocument()
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

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'cancelled')
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

    const reporterBtn = await screen.findByRole('button', { name: /Reporter Arranging Transport/i })
    fireEvent.click(reporterBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'dispatched', 'reporter')
    })
  })

  it('progresses stage from dispatched to attended when Mark Attended is clicked', async () => {
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

    const updateStageSpy = vi.spyOn(domainModule, 'updateReportStage').mockResolvedValue(undefined)

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
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'attended')
    })
  })

  it('handles disposition options at attended stage: spot release with auto animal creation', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'attended',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T14:20:00Z',
      stage_dispatched_at: '2026-10-13T14:35:00Z',
      stage_attended_at: '2026-10-13T14:50:00Z',
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

    const setDispBtn = await screen.findByRole('button', { name: /Set Disposition/i })
    fireEvent.click(setDispBtn)

    // In disposition modal/menu, select Spot Release (TNR)
    const spotReleaseBtn = await screen.findByRole('button', { name: /Spot Release \(TNR\)/i })
    fireEvent.click(spotReleaseBtn)

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'spot_released', 'mock-animal-1')
    })
  })

  it('handles disposition options at attended stage: admit to shelter with auto animal creation', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'attended',
      species: 'dog',
      chief_complaint: 'Fracture',
      location_area: 'Burns Road',
      stage_logged_at: '2026-10-13T14:10:00Z',
      stage_accepted_at: '2026-10-13T14:20:00Z',
      stage_dispatched_at: '2026-10-13T14:35:00Z',
      stage_attended_at: '2026-10-13T14:50:00Z',
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

    const setDispBtn = await screen.findByRole('button', { name: /Set Disposition/i })
    fireEvent.click(setDispBtn)

    const admitBtn = await screen.findByRole('button', { name: /Admit to Shelter/i })
    fireEvent.click(admitBtn)

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'admitted_shelter', 'mock-animal-1')
    })
  })

  it('allows changing decision when completed or cancelled', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-1',
      org_id: 'org-1',
      report_number: 'PARC-R105',
      status: 'attended',
      disposition_type: 'spot_released',
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

    const changeBtn = await screen.findByRole('button', { name: /Change decision/i })
    fireEvent.click(changeBtn)

    // Modal opens, pick "Reopen as Logged"
    const reopenBtn = await screen.findByRole('button', { name: /Reopen as Logged/i })
    fireEvent.click(reopenBtn)

    await waitFor(() => {
      expect(updateStageSpy).toHaveBeenCalledWith(expect.anything(), 'rep-1', 'logged')
    })
  })
})
