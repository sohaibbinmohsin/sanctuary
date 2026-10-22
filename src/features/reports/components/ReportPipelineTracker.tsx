import type { RescueReport } from '@/features/reports/domain/rescueReports'
import { Check } from '@phosphor-icons/react'

export type ReportPipelineTrackerProps = {
  report: RescueReport
}

type StepStatus = 'completed' | 'current' | 'upcoming'

interface PipelineStep {
  number: number
  title: string
  status: StepStatus
  timeText: string
}

function formatPipelineTime(isoString?: string | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'

  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `Today ${hours}:${minutes}`
}

export function ReportPipelineTracker({ report }: ReportPipelineTrackerProps) {
  const currentStatus = report.status ?? 'logged'

  const isCruelty = report.category === 'cruelty'

  // Determine stage status and time text for each of the 4 milestones:
  // Emergency: 1. Report Logged, 2. Triage Decision, 3. Field & Transport, 4. Animal Attended
  // Cruelty:   1. Complaint Logged, 2. Investigation, 3. Notice / Legal Action, 4. Custody / Resolution

  const steps: PipelineStep[] = isCruelty
    ? [
        {
          number: 1,
          title: 'Complaint Logged',
          status: 'completed',
          timeText: formatPipelineTime(report.stage_logged_at || report.created_at),
        },
        {
          number: 2,
          title: 'Investigation',
          status:
            currentStatus === 'logged'
              ? 'current'
              : currentStatus === 'cancelled'
                ? 'upcoming'
                : 'completed',
          timeText:
            currentStatus === 'logged'
              ? 'Awaiting investigation'
              : report.stage_accepted_at
                ? formatPipelineTime(report.stage_accepted_at)
                : currentStatus === 'cancelled'
                  ? 'Dismissed'
                  : 'Completed',
        },
        {
          number: 3,
          title: 'Notice / Legal Action',
          status:
            currentStatus === 'accepted' || currentStatus === 'dispatched'
              ? 'current'
              : currentStatus === 'attended'
                ? 'completed'
                : 'upcoming',
          timeText:
            currentStatus === 'logged' || currentStatus === 'cancelled'
              ? '—'
              : currentStatus === 'accepted'
                ? 'Awaiting notice / action'
                : currentStatus === 'dispatched'
                  ? report.stage_dispatched_at
                    ? `Action Filed (${formatPipelineTime(report.stage_dispatched_at)})`
                    : 'Action Filed'
                  : report.stage_dispatched_at
                    ? formatPipelineTime(report.stage_dispatched_at)
                    : '—',
        },
        {
          number: 4,
          title: 'Custody / Resolution',
          status: currentStatus === 'attended' ? 'completed' : 'upcoming',
          timeText:
            currentStatus === 'attended'
              ? report.disposition_type === 'spot_released'
                ? `Resolved On-Site (${formatPipelineTime(report.stage_attended_at)})`
                : report.stage_attended_at
                  ? `In Custody (${formatPipelineTime(report.stage_attended_at)})`
                  : 'In Custody'
              : '—',
        },
      ]
    : [
        {
          number: 1,
          title: 'Report Logged',
          status: 'completed',
          timeText: formatPipelineTime(report.stage_logged_at || report.created_at),
        },
        {
          number: 2,
          title: 'Triage Decision',
          status:
            currentStatus === 'logged'
              ? 'current'
              : currentStatus === 'cancelled'
                ? 'upcoming'
                : 'completed',
          timeText:
            currentStatus === 'logged'
              ? 'Awaiting decision'
              : report.stage_accepted_at
                ? formatPipelineTime(report.stage_accepted_at)
                : currentStatus === 'cancelled'
                  ? 'Cancelled'
                  : 'Completed',
        },
        {
          number: 3,
          title: 'Field & Transport',
          status:
            currentStatus === 'accepted' || currentStatus === 'dispatched'
              ? 'current'
              : currentStatus === 'attended'
                ? 'completed'
                : 'upcoming',
          timeText:
            currentStatus === 'logged' || currentStatus === 'cancelled'
              ? '—'
              : currentStatus === 'accepted'
                ? 'Awaiting dispatch'
                : currentStatus === 'dispatched'
                  ? report.transport_type === 'reporter'
                    ? `Reporter Transporting (${formatPipelineTime(report.stage_dispatched_at)})`
                    : `En Route (${formatPipelineTime(report.stage_dispatched_at)})`
                  : report.stage_dispatched_at
                    ? report.transport_type === 'reporter'
                      ? `Reporter Transported (${formatPipelineTime(report.stage_dispatched_at)})`
                      : formatPipelineTime(report.stage_dispatched_at)
                    : '—',
        },
        {
          number: 4,
          title: 'Animal Attended',
          status: currentStatus === 'attended' ? 'completed' : 'upcoming',
          timeText:
            currentStatus === 'attended'
              ? report.disposition_type === 'spot_released'
                ? `Spot Released (${formatPipelineTime(report.stage_attended_at)})`
                : report.stage_attended_at
                  ? formatPipelineTime(report.stage_attended_at)
                  : 'Attended'
              : '—',
        },
      ]

  return (
    <div className="stepper-card">
      <div className="stepper-track" role="list" aria-label="Rescue report stages">
        {steps.map((step, index) => (
          <div key={step.number} className="stepper-step-wrapper">
            <div
              className={`stepper-step ${step.status}`}
              role="listitem"
              aria-current={step.status === 'current' ? 'step' : undefined}
            >
              <div className="stepper-circle">
                <span className="stepper-num">{step.number}</span>
                <Check className="stepper-check" weight="bold" size={14} aria-hidden />
              </div>
              <div className="stepper-label-group">
                <span className="stepper-label-title">{step.title}</span>
                <span className="stepper-stage-time">{step.timeText}</span>
              </div>
            </div>
            {index < steps.length - 1 && <div className="stepper-connector" aria-hidden />}
          </div>
        ))}
      </div>
    </div>
  )
}
