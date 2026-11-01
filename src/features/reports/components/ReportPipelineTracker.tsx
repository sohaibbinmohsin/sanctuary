import type { RescueReport } from '@/features/reports/domain/rescueReports'
import type { ReportCompletionResult } from '@/features/reports/domain/reportOutcomes'
import { Check } from '@phosphor-icons/react'

export type ReportPipelineTrackerProps = {
  report: RescueReport
  outcomeStatus?: ReportCompletionResult | null
  onStepClick?: (stepNumber: number) => void
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
  const timeStr = `${hours}:${minutes}`

  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) {
    return `Today ${timeStr}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  if (isYesterday) {
    return `Yesterday ${timeStr}`
  }

  const day = d.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const currentYear = now.getFullYear()

  if (year === currentYear) {
    return `${day} ${month}, ${timeStr}`
  }
  return `${day} ${month} ${year}, ${timeStr}`
}

export function ReportPipelineTracker({
  report,
  outcomeStatus,
  onStepClick,
}: ReportPipelineTrackerProps) {
  const currentStatus = report.status ?? 'logged'
  const disp = report.disposition_type
  const isCruelty = report.category === 'cruelty'
  const isWalkIn = report.intake_source === 'walk_in' || report.intake_source === 'direct_intake'
  const isCancelled = currentStatus === 'cancelled'

  let steps: PipelineStep[]

  if (isWalkIn) {
    // 3-step pipeline: 1. Intake Logged, 2. Admitted / In Custody, 3. Outcome & Placement
    const isAdmitted =
      currentStatus === 'attended' ||
      Boolean(report.stage_attended_at) ||
      Boolean(report.animal_id)

    const isStep3Completed =
      !isCancelled &&
      Boolean(outcomeStatus?.isCompleted || disp === 'spot_released' || disp === 'deceased_doa')

    steps = [
      {
        number: 1,
        title: 'Intake Logged',
        status: 'completed',
        timeText: formatPipelineTime(report.stage_logged_at || report.created_at),
      },
      {
        number: 2,
        title: 'Admitted / In Custody',
        status: isCancelled
          ? 'upcoming'
          : isAdmitted
            ? 'completed'
            : currentStatus === 'logged'
              ? 'current'
              : 'completed',
        timeText: isCancelled
          ? 'Cancelled'
          : report.stage_attended_at
            ? formatPipelineTime(report.stage_attended_at)
            : currentStatus === 'attended' || Boolean(report.animal_id)
              ? formatPipelineTime(report.stage_logged_at || report.created_at)
              : currentStatus === 'logged'
                ? 'Awaiting intake'
                : '—',
      },
      {
        number: 3,
        title: 'Outcome & Placement',
        status: isStep3Completed
          ? 'completed'
          : !isCancelled && isAdmitted
            ? 'current'
            : 'upcoming',
        timeText: (() => {
          if (isCancelled) return '—'
          if (isStep3Completed) {
            const label =
              outcomeStatus?.outcomeLabel ||
              (disp === 'spot_released'
                ? 'Spot Released'
                : disp === 'deceased_doa'
                  ? 'Dead on Arrival'
                  : 'Completed')
            const timeIso =
              outcomeStatus?.completedAt ||
              (disp === 'spot_released' || disp === 'deceased_doa'
                ? report.stage_attended_at
                : report.updated_at)
            const formatted = formatPipelineTime(timeIso)
            return formatted && formatted !== '—' ? `${label} · ${formatted}` : label
          }
          if (!isCancelled && isAdmitted) {
            return outcomeStatus?.outcomeLabel || 'In Care'
          }
          return '—'
        })(),
      },
    ]
  } else if (isCruelty) {
    // Cruelty: 1. Complaint Logged, 2. Investigation, 3. Notice / Legal Action, 4. Custody / Resolution
    steps = [
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
            ? report.stage_attended_at
              ? formatPipelineTime(report.stage_attended_at)
              : 'Attended'
            : '—',
      },
    ]
  } else {
    // 5-step pipeline: 1. Report Logged, 2. Triage Decision, 3. Field & Transport, 4. Animal Attended, 5. Outcome & Placement
    const isAttended =
      currentStatus === 'attended' || Boolean(report.stage_attended_at)

    const isStep5Completed =
      !isCancelled &&
      Boolean(outcomeStatus?.isCompleted || disp === 'spot_released' || disp === 'deceased_doa')

    steps = [
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
            : isAttended
              ? 'completed'
              : 'upcoming',
        timeText:
          currentStatus === 'logged' || currentStatus === 'cancelled'
            ? '—'
            : currentStatus === 'accepted'
              ? 'Awaiting dispatch'
              : report.stage_dispatched_at
                ? formatPipelineTime(report.stage_dispatched_at)
                : '—',
      },
      {
        number: 4,
        title: 'Animal Attended',
        status: isAttended ? 'completed' : 'upcoming',
        timeText: isAttended
          ? report.stage_attended_at
            ? formatPipelineTime(report.stage_attended_at)
            : 'Attended'
          : '—',
      },
      {
        number: 5,
        title: 'Outcome & Placement',
        status: isStep5Completed
          ? 'completed'
          : !isCancelled && isAttended
            ? 'current'
            : 'upcoming',
        timeText: (() => {
          if (isCancelled) return '—'
          if (isStep5Completed) {
            const label =
              outcomeStatus?.outcomeLabel ||
              (disp === 'spot_released'
                ? 'Spot Released'
                : disp === 'deceased_doa'
                  ? 'Dead on Arrival'
                  : 'Completed')
            const timeIso =
              outcomeStatus?.completedAt ||
              (disp === 'spot_released' || disp === 'deceased_doa'
                ? report.stage_attended_at
                : report.updated_at)
            const formatted = formatPipelineTime(timeIso)
            return formatted && formatted !== '—' ? `${label} · ${formatted}` : label
          }
          if (!isCancelled && isAttended) {
            return outcomeStatus?.outcomeLabel || 'In Care'
          }
          return '—'
        })(),
      },
    ]
  }

  return (
    <div className="stepper-card">
      <div className="stepper-track" role="list" aria-label="Rescue report stages">
        {steps.map((step, index) => (
          <div key={step.number} className="stepper-step-wrapper">
            <div
              className={`stepper-step ${step.status} ${onStepClick ? 'clickable' : ''}`}
              role="listitem"
              aria-current={step.status === 'current' ? 'step' : undefined}
              onClick={() => onStepClick?.(step.number)}
              style={onStepClick ? { cursor: 'pointer' } : undefined}
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
