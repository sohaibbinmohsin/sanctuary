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
})
