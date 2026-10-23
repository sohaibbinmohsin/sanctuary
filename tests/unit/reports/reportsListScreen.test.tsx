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
  it('renders timeline grouped reports, search bar, and header link', async () => {
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
    expect(screen.getByRole('link', { name: /Log report/i })).toHaveAttribute('href', '/reports/new')
    expect(screen.getByPlaceholderText(/Search by ID, species, complaint, or location/i)).toBeInTheDocument()
  })

  it('filters reports live via the search input', async () => {
    vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([
      {
        id: 'rep-1',
        org_id: 'org-1',
        report_number: 'PARC-R105',
        species: 'dog',
        chief_complaint: 'Hit by rickshaw',
        location_area: 'Burns Road',
        created_at: new Date().toISOString(),
      } as any,
      {
        id: 'rep-2',
        org_id: 'org-1',
        report_number: 'PARC-R106',
        species: 'cat',
        chief_complaint: 'Injured eye',
        location_area: 'Clifton',
        created_at: new Date().toISOString(),
      } as any,
    ])

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('PARC-R105')).toBeInTheDocument()
    expect(screen.getByText('PARC-R106')).toBeInTheDocument()

    // Type 'Clifton' into search
    const searchInput = screen.getByPlaceholderText(/Search by ID, species, complaint, or location/i)
    fireEvent.change(searchInput, { target: { value: 'Clifton' } })

    expect(screen.queryByText('PARC-R105')).not.toBeInTheDocument()
    expect(screen.getByText('PARC-R106')).toBeInTheDocument()
  })

  it('renders standard EmptyState when no reports exist', async () => {
    vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([])

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No reports yet')).toBeInTheDocument()
    const emptyAction = screen.getByRole('link', { name: /Log report/i })
    expect(emptyAction).toHaveAttribute('href', '/reports/new')
  })

  it('keeps Log report button in middle EmptyState when status filter has no reports', async () => {
    const getRescueReportsSpy = vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([])

    const { container } = render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    const inProgressChip = screen.getByRole('button', { name: 'In progress' })
    fireEvent.click(inProgressChip)

    await waitFor(() => {
      expect(getRescueReportsSpy).toHaveBeenCalledWith(expect.anything(), 'org-1', 'in_progress')
    })

    expect(await screen.findByText('No matches')).toBeInTheDocument()
    expect(container.querySelector('.page-header__actions')).toBeNull()
    const emptyStateLink = container.querySelector('.empty-state a[href="/reports/new"]')
    expect(emptyStateLink).not.toBeNull()
  })

  it('renders initial batch of 60 reports and expands when Load more is clicked', async () => {
    const mockReports = Array.from({ length: 80 }, (_, i) => ({
      id: `rep-${i + 1}`,
      org_id: 'org-1',
      report_number: `PARC-R${1001 + i}`,
      species: 'dog',
      chief_complaint: `Complaint ${i + 1}`,
      status: 'attended',
      location_area: 'Gulberg III',
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
    }))

    vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue(mockReports as any)

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    // First card should be rendered
    expect(await screen.findByText('PARC-R1001')).toBeInTheDocument()
    // 60th card should be rendered
    expect(screen.getByText('PARC-R1060')).toBeInTheDocument()
    // 61st card should NOT be in DOM initially
    expect(screen.queryByText('PARC-R1061')).not.toBeInTheDocument()

    // "Load more (20 remaining)" button should be present
    const loadMoreBtn = screen.getByRole('button', { name: /Load more \(20 remaining\)/i })
    expect(loadMoreBtn).toBeInTheDocument()

    // Click Load more
    fireEvent.click(loadMoreBtn)

    // 61st and 80th cards should now be rendered
    expect(await screen.findByText('PARC-R1061')).toBeInTheDocument()
    expect(screen.getByText('PARC-R1080')).toBeInTheDocument()
    // Load more button should disappear once all are loaded
    expect(screen.queryByRole('button', { name: /Load more/i })).not.toBeInTheDocument()
  })

  it('selects New reports by default when awaiting triage count > 0 and displays badge count', async () => {
    vi.spyOn(domainModule, 'getRescueOperationsSummary').mockResolvedValue({
      total: 10,
      awaitingTriage: 3,
      inField: 2,
      attended: 5,
      cancelled: 0,
    })

    const getRescueReportsSpy = vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([
      {
        id: 'rep-new-1',
        org_id: 'org-1',
        report_number: 'PARC-R200',
        species: 'cat',
        chief_complaint: 'Stuck on roof',
        status: 'logged',
        location_area: 'Johar Town',
        created_at: new Date().toISOString(),
      } as any,
    ])

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    // Option 2 selects 'new' filter
    await waitFor(() => {
      expect(getRescueReportsSpy).toHaveBeenCalledWith(expect.anything(), 'org-1', 'new')
    })

    // Active pill should be New reports
    const newChip = screen.getByRole('button', { name: /New reports/i })
    expect(newChip).toHaveAttribute('aria-pressed', 'true')
    // Badge counter with 3 should be displayed
    expect(newChip).toHaveTextContent('3')

    // In progress chip should have counter 2
    const inProgressChip = screen.getByRole('button', { name: /In progress/i })
    expect(inProgressChip).toHaveTextContent('2')

    // All chip should NOT have a counter badge
    const allChip = screen.getByRole('button', { name: /^All$/i })
    expect(allChip.querySelector('.chip-counter')).toBeNull()
  })

  it('selects In progress by default when awaiting triage count is 0 and inField > 0', async () => {
    vi.spyOn(domainModule, 'getRescueOperationsSummary').mockResolvedValue({
      total: 10,
      awaitingTriage: 0,
      inField: 4,
      attended: 6,
      cancelled: 0,
    })

    const getRescueReportsSpy = vi.spyOn(domainModule, 'getRescueReports').mockResolvedValue([
      {
        id: 'rep-inp-1',
        org_id: 'org-1',
        report_number: 'PARC-R201',
        species: 'dog',
        chief_complaint: 'En route with ambulance',
        status: 'dispatched',
        location_area: 'Gulberg III',
        created_at: new Date().toISOString(),
      } as any,
    ])

    render(
      <MemoryRouter>
        <ReportsListScreen />
      </MemoryRouter>,
    )

    // Option 2 selects 'in_progress' filter
    await waitFor(() => {
      expect(getRescueReportsSpy).toHaveBeenCalledWith(expect.anything(), 'org-1', 'in_progress')
    })

    // Active pill should be In progress
    const inProgressChip = screen.getByRole('button', { name: /In progress/i })
    expect(inProgressChip).toHaveAttribute('aria-pressed', 'true')
    expect(inProgressChip).toHaveTextContent('4')

    // New reports chip has 0 count, so it should not render a counter badge
    const newChip = screen.getByRole('button', { name: /^New reports$/i })
    expect(newChip.querySelector('.chip-counter')).toBeNull()
  })
})

