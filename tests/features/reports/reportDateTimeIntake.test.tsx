import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReportIntakeScreen } from '@/features/reports/screens/ReportIntakeScreen'
import {
  createRescueReport,
  toDatetimeLocalValue,
} from '@/features/reports/domain/rescueReports'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockDb = {
  execute: vi.fn(async () => {}),
  getAll: vi.fn(async () => []),
  getOptional: vi.fn(async () => null),
}

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: vi.fn(() => mockDb),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: vi.fn(() => ({ member: { orgId: 'org-1', orgInitials: 'SANCTUARY' } })),
}))

vi.mock('@/features/reports/domain/rescueReports', async () => {
  const actual = await vi.importActual('@/features/reports/domain/rescueReports')
  return {
    ...actual,
    generateReportNumber: vi.fn(async () => 'SANCTUARY-R101'),
    createRescueReport: vi.fn(async (_db, input) => ({
      id: 'mock-report-id',
      org_id: input.orgId,
      report_number: input.reportNumber,
      category: input.category || 'emergency',
      species: input.species,
      life_stage: input.lifeStage || 'adult',
      chief_complaint: input.chiefComplaint,
      status: input.status || 'logged',
      city: input.city || 'Lahore',
      location_area: input.locationArea,
      location_landmark: input.locationLandmark || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      reporter_name: input.reporterName || null,
      reporter_phone: input.reporterPhone || null,
      reporter_cnic: input.reporterCnic || null,
      transport_type: null,
      disposition_type: input.dispositionType || null,
      animal_id: input.animalId || null,
      legal_notes: null,
      dismissal_reason: null,
      intake_source: input.intakeSource || 'citizen',
      animal_count: input.animalCount || 1,
      group_breakdown: input.groupBreakdown || null,
      archived: 0,
      stage_logged_at: input.createdAt || new Date().toISOString(),
      stage_accepted_at: null,
      stage_dispatched_at: null,
      stage_attended_at: input.stageAttendedAt || null,
      created_at: input.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    createAnimalFromRescueReport: vi.fn(async () => 'mock-animal-123'),
    syncReportPhotosToAnimal: vi.fn(async () => {}),
  }
})

describe('ReportIntakeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders date & time input for backdating with Report Date & Time label for standard reports', () => {
    render(
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path="/reports/new" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByLabelText(/Report Date & Time/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Log a rescue report/i })).toBeInTheDocument()
  })

  it('renders Walk-in title, default walk_in source, and Intake Date & Time label when ?type=walk-in', () => {
    render(
      <MemoryRouter initialEntries={['/reports/new?type=walk-in']}>
        <Routes>
          <Route path="/reports/new" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: /Log Walk-in Intake/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Intake Date & Time/i)).toBeInTheDocument()
    const walkInChip = screen.getByRole('button', { name: /Walk-in \/ Direct/i })
    expect(walkInChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('submits walk-in intake with attended status, backdated time, and creates animal', async () => {
    render(
      <MemoryRouter initialEntries={['/reports/new?type=walk-in']}>
        <Routes>
          <Route path="/reports/new" element={<ReportIntakeScreen />} />
        </Routes>
      </MemoryRouter>
    )

    const dateInput = screen.getByLabelText(/Intake Date & Time/i)
    fireEvent.change(dateInput, { target: { value: '2026-10-15T09:30' } })

    const complaintInput = screen.getByRole('textbox', { name: /Chief complaint \/ Injury/i })
    fireEvent.change(complaintInput, { target: { value: 'Hit by motorcycle, broken leg' } })

    const submitBtn = screen.getByRole('button', { name: /Log walk-in intake/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createRescueReport).toHaveBeenCalled()
    })

    const createCallArgs = vi.mocked(createRescueReport).mock.calls[0][1]
    expect(createCallArgs.status).toBe('attended')
    expect(createCallArgs.dispositionType).toBe('admitted_shelter')
    expect(createCallArgs.intakeSource).toBe('walk_in')
    expect(createCallArgs.createdAt).toContain('2026-10-15')
    expect(createCallArgs.stageAttendedAt).toContain('2026-10-15')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/reports/mock-report-id', { replace: true })
    })
  })
})

describe('domain rescueReports backdating support', () => {
  it('formats dates properly with toDatetimeLocalValue', () => {
    const d = new Date('2026-11-01T15:45:00.000Z')
    const val = toDatetimeLocalValue(d)
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('createRescueReport honors createdAt, status, stageAttendedAt, and dispositionType', async () => {
    const unmockedRescue = await vi.importActual<typeof import('@/features/reports/domain/rescueReports')>(
      '@/features/reports/domain/rescueReports'
    )
    const dbMock = {
      execute: vi.fn(async () => {}),
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
    }

    const report = await unmockedRescue.createRescueReport(dbMock as any, {
      orgId: 'org-test',
      reportNumber: 'TEST-R101',
      species: 'Dog',
      chiefComplaint: 'Fractured leg',
      locationArea: 'Gulberg III',
      createdAt: '2026-10-12T10:00:00.000Z',
      status: 'attended',
      stageAttendedAt: '2026-10-12T10:00:00.000Z',
      dispositionType: 'admitted_shelter',
      animalId: 'animal-xyz',
    })

    expect(report.status).toBe('attended')
    expect(report.stage_attended_at).toBe('2026-10-12T10:00:00.000Z')
    expect(report.created_at).toBe('2026-10-12T10:00:00.000Z')
    expect(report.stage_logged_at).toBe('2026-10-12T10:00:00.000Z')
    expect(report.disposition_type).toBe('admitted_shelter')
    expect(report.animal_id).toBe('animal-xyz')
  })

  it('updateRescueReport updates createdAt and stageAttendedAt when provided', async () => {
    const unmockedRescue = await vi.importActual<typeof import('@/features/reports/domain/rescueReports')>(
      '@/features/reports/domain/rescueReports'
    )
    const executeMock = vi.fn(async (..._args: any[]) => {})
    const dbMock = {
      execute: executeMock,
      getAll: vi.fn(async () => []),
      getOptional: vi.fn(async () => null),
    }

    await unmockedRescue.updateRescueReport(dbMock as any, 'report-1', {
      createdAt: '2026-10-10T08:00:00.000Z',
      stageAttendedAt: '2026-10-10T08:00:00.000Z',
      status: 'attended',
      dispositionType: 'admitted_shelter',
    })

    expect(executeMock).toHaveBeenCalled()
    const updateCall = (executeMock.mock.calls as any[][]).find((c) => String(c[0]).includes('UPDATE rescue_reports'))
    expect(updateCall).toBeDefined()
    const query = String(updateCall?.[0])
    expect(query).toContain('created_at = ?')
    expect(query).toContain('stage_logged_at = ?')
    expect(query).toContain('stage_attended_at = ?')
    expect(query).toContain('status = ?')
    expect(query).toContain('disposition_type = ?')
  })
})
