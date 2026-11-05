import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReportAnimalsScreen } from '@/features/reports/screens/ReportAnimalsScreen'
import * as domainModule from '@/features/reports/domain/rescueReports'
import * as outcomesModule from '@/features/reports/domain/reportOutcomes'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([]),
    getOptional: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: vi.fn(() => ({
    member: { orgId: 'org-1', orgName: 'Shelter', orgInitials: 'PARC' },
    loading: false,
  })),
}))

describe('ReportAnimalsScreen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders report animals and back link to report', async () => {
    vi.spyOn(domainModule, 'getRescueReportById').mockResolvedValue({
      id: 'rep-group-1',
      org_id: 'org-1',
      report_number: 'PARC-R201',
      category: 'emergency',
      species: 'dog',
      animal_count: 2,
      animal_id: 'anim-1',
      status: 'attended',
    } as any)

    vi.spyOn(outcomesModule, 'getReportAnimals').mockResolvedValue([
      {
        id: 'anim-1',
        org_id: 'org-1',
        shelter_code: 'PARC-001',
        name: 'Buddy',
        species: 'dog',
        life_stage: 'adult',
        status_id: 'st-1',
        status_label: 'In Care',
        counts_as_in_care: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'anim-2',
        org_id: 'org-1',
        shelter_code: 'PARC-002',
        name: 'Milo',
        species: 'dog',
        life_stage: 'adult',
        status_id: 'st-1',
        status_label: 'In Care',
        counts_as_in_care: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])

    render(
      <MemoryRouter initialEntries={['/reports/rep-group-1/animals']}>
        <Routes>
          <Route path="/reports/:id/animals" element={<ReportAnimalsScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    // Back link to report
    const backLink = await screen.findByRole('link', { name: /PARC-R201/i })
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/reports/rep-group-1')

    // Animal cards rendered
    expect(await screen.findByText('Buddy')).toBeInTheDocument()
    expect(screen.getByText('Milo')).toBeInTheDocument()

    // Links to animals with group state
    const buddyLink = screen.getByRole('img', { name: /Buddy/i })
    expect(buddyLink).toHaveAttribute('href', '/animals/anim-1?from_group_report=rep-group-1')
  })
})
