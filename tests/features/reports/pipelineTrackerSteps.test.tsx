import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportPipelineTracker } from '@/features/reports/components/ReportPipelineTracker'
import type { RescueReport } from '@/features/reports/domain/rescueReports'
import type { ReportCompletionResult } from '@/features/reports/domain/reportOutcomes'

describe('ReportPipelineTracker', () => {
  it('renders 5 steps for standard field rescue report', () => {
    const report: Partial<RescueReport> = {
      id: 'r1',
      status: 'logged',
      intake_source: 'citizen',
      created_at: new Date().toISOString(),
    }
    render(<ReportPipelineTracker report={report as RescueReport} />)
    expect(screen.getByText('Report Logged')).toBeInTheDocument()
    expect(screen.getByText('Triage Decision')).toBeInTheDocument()
    expect(screen.getByText('Field & Transport')).toBeInTheDocument()
    expect(screen.getByText('Animal Attended')).toBeInTheDocument()
    expect(screen.getByText('Outcome & Placement')).toBeInTheDocument()
  })

  it('renders 3 steps for direct walk-in report', () => {
    const report: Partial<RescueReport> = {
      id: 'r2',
      status: 'attended',
      intake_source: 'walk_in',
      created_at: new Date().toISOString(),
    }
    render(<ReportPipelineTracker report={report as RescueReport} />)
    expect(screen.getByText('Intake Logged')).toBeInTheDocument()
    expect(screen.getByText('Admitted / In Custody')).toBeInTheDocument()
    expect(screen.getByText('Outcome & Placement')).toBeInTheDocument()
    expect(screen.queryByText('Field & Transport')).not.toBeInTheDocument()
  })

  it('renders 3 steps for direct_intake intake_source', () => {
    const report: Partial<RescueReport> = {
      id: 'r2b',
      status: 'attended',
      intake_source: 'direct_intake',
      created_at: new Date().toISOString(),
    }
    render(<ReportPipelineTracker report={report as RescueReport} />)
    expect(screen.getByText('Intake Logged')).toBeInTheDocument()
    expect(screen.getByText('Admitted / In Custody')).toBeInTheDocument()
    expect(screen.getByText('Outcome & Placement')).toBeInTheDocument()
    expect(screen.queryByText('Field & Transport')).not.toBeInTheDocument()
  })

  it('reflects completed outcome status on field rescue Step 5', () => {
    const report: Partial<RescueReport> = {
      id: 'r3',
      status: 'attended',
      stage_attended_at: new Date().toISOString(),
      intake_source: 'citizen',
      created_at: new Date().toISOString(),
    }
    const outcomeStatus: ReportCompletionResult = {
      isCompleted: true,
      outcomeLabel: 'Transferred',
      activeCount: 0,
      completedCount: 1,
    }
    render(
      <ReportPipelineTracker
        report={report as RescueReport}
        outcomeStatus={outcomeStatus}
      />
    )
    expect(screen.getByText('Outcome & Placement')).toBeInTheDocument()
    expect(screen.getByText('Transferred')).toBeInTheDocument()
  })

  it('shows In Care when field rescue is attended but not yet completed', () => {
    const report: Partial<RescueReport> = {
      id: 'r4',
      status: 'attended',
      stage_attended_at: new Date().toISOString(),
      intake_source: 'citizen',
      created_at: new Date().toISOString(),
    }
    const outcomeStatus: ReportCompletionResult = {
      isCompleted: false,
      outcomeLabel: 'Under Treatment',
      activeCount: 1,
      completedCount: 0,
    }
    render(
      <ReportPipelineTracker
        report={report as RescueReport}
        outcomeStatus={outcomeStatus}
      />
    )
    expect(screen.getByText('Outcome & Placement')).toBeInTheDocument()
    expect(screen.getByText('Under Treatment')).toBeInTheDocument()
  })
})
