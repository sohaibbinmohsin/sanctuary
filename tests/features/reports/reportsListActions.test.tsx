import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReportsListScreen } from '@/features/reports/screens/ReportsListScreen'
import { ReportTimelineCard } from '@/features/reports/components/ReportTimelineCard'
import type { RescueReport } from '@/features/reports/domain/rescueReports'
import * as rescueReportsDomain from '@/features/reports/domain/rescueReports'
import * as reportOutcomesDomain from '@/features/reports/domain/reportOutcomes'

const mockReports: Partial<RescueReport>[] = [
  {
    id: 'rep-1',
    org_id: 'org-1',
    report_number: 'PARC-R101',
    species: 'dog',
    chief_complaint: 'Injured leg',
    status: 'attended',
    disposition_type: 'admitted_shelter',
    animal_id: 'animal-1',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rep-2',
    org_id: 'org-1',
    report_number: 'PARC-R102',
    species: 'cat',
    chief_complaint: 'Spot released dog',
    status: 'attended',
    disposition_type: 'spot_released',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([]),
    getOptional: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: vi.fn(() => ({ member: { orgId: 'org-1', orgName: 'Shelter' } })),
}))

describe('ReportsListScreen Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(rescueReportsDomain, 'getRescueOperationsSummary').mockResolvedValue({
      total: 2,
      awaitingTriage: 0,
      inField: 0,
      attended: 2,
      cancelled: 0,
    })
    vi.spyOn(rescueReportsDomain, 'getRescueReports').mockImplementation(async (_db, _orgId, filter) => {
      if (filter === 'completed') {
        return mockReports.filter((r) => r.status === 'attended' || r.status === 'cancelled') as RescueReport[]
      }
      return mockReports as RescueReport[]
    })
  })

  it('renders split button with Log report and opens dropdown with Log walk-in', async () => {
    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    const mainBtn = screen.getByRole('link', { name: /Log report/i })
    expect(mainBtn).toBeInTheDocument()
    expect(mainBtn).toHaveAttribute('href', '/reports/new')

    const toggleBtn = screen.getByTitle(/More report actions/i)
    expect(toggleBtn).toBeInTheDocument()

    // Initially dropdown is closed
    expect(screen.queryByRole('link', { name: /Log walk-in/i })).not.toBeInTheDocument()

    // Click toggle to open
    fireEvent.click(toggleBtn)
    const walkInLink = screen.getByRole('link', { name: /Log walk-in/i })
    expect(walkInLink).toBeInTheDocument()
    expect(walkInLink).toHaveAttribute('href', '/reports/new?type=walk-in')

    // Escape closes dropdown
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('link', { name: /Log walk-in/i })).not.toBeInTheDocument()

    // Reopen and test outside click
    fireEvent.click(toggleBtn)
    expect(screen.getByRole('link', { name: /Log walk-in/i })).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('link', { name: /Log walk-in/i })).not.toBeInTheDocument()
  })

  it('filters reports into in_progress vs completed based on completion outcomes', async () => {
    // rep-1 has linked animal still in care (Under Treatment)
    // rep-2 has spot_released (completed)
    vi.spyOn(reportOutcomesDomain, 'getBatchReportCompletionMap').mockResolvedValue(
      new Map([
        [
          'rep-1',
          {
            isCompleted: false,
            outcomeLabel: 'Under Treatment',
            activeCount: 1,
            completedCount: 0,
          },
        ],
        [
          'rep-2',
          {
            isCompleted: true,
            outcomeLabel: 'Spot Released',
            activeCount: 0,
            completedCount: 1,
          },
        ],
      ]),
    )

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    // Wait for initial load
    expect(await screen.findByText('PARC-R101')).toBeInTheDocument()
    expect(screen.getByText('PARC-R102')).toBeInTheDocument()

    // Click In Progress chip
    const inProgressChip = screen.getByRole('button', { name: /In progress/i })
    fireEvent.click(inProgressChip)

    await waitFor(() => {
      // rep-1 is attended but still in care, so it should be visible in In Progress
      expect(screen.getByText('PARC-R101')).toBeInTheDocument()
      // rep-2 is spot_released (completed), so it should NOT be in In Progress
      expect(screen.queryByText('PARC-R102')).not.toBeInTheDocument()
    })

    // Click Completed chip
    const completedChip = screen.getByRole('button', { name: /Completed/i })
    fireEvent.click(completedChip)

    await waitFor(() => {
      // rep-2 is completed, so it should be visible
      expect(screen.getByText('PARC-R102')).toBeInTheDocument()
      // rep-1 is still in care, so it should NOT be in Completed
      expect(screen.queryByText('PARC-R101')).not.toBeInTheDocument()
    })
  })
})

describe('ReportTimelineCard completion badge', () => {
  it('renders completed badge when outcomeStatus.isCompleted is true', () => {
    const report: Partial<RescueReport> = {
      id: 'r-done',
      report_number: 'PARC-R300',
      species: 'cat',
      chief_complaint: 'Rescued kitten',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      created_at: new Date().toISOString(),
    }
    const outcomeStatus: reportOutcomesDomain.ReportCompletionResult = {
      isCompleted: true,
      outcomeLabel: 'Adopted',
      activeCount: 0,
      completedCount: 1,
    }

    render(
      <MemoryRouter>
        <ReportTimelineCard report={report as RescueReport} outcomeStatus={outcomeStatus} />
      </MemoryRouter>,
    )

    const badge = screen.getByText('Adopted')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('status-badge-clean')
    expect(badge).toHaveClass('completed')
  })

  it('renders shelter/in-care badge when attended and outcomeStatus.isCompleted is false', () => {
    const report: Partial<RescueReport> = {
      id: 'r-care',
      report_number: 'PARC-R301',
      species: 'dog',
      chief_complaint: 'Fractured paw',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      created_at: new Date().toISOString(),
    }
    const outcomeStatus: reportOutcomesDomain.ReportCompletionResult = {
      isCompleted: false,
      outcomeLabel: 'In Care',
      activeCount: 1,
      completedCount: 0,
    }

    render(
      <MemoryRouter>
        <ReportTimelineCard report={report as RescueReport} outcomeStatus={outcomeStatus} />
      </MemoryRouter>,
    )

    const badge = screen.getByText('In Care')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('status-badge-clean')
    expect(badge).toHaveClass('shelter')
  })
})
