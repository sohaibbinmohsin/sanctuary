import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  CaretLeft,
  CaretDown,
  CheckCircle,
  Truck,
  FirstAid,
  XCircle,
  HouseSimple,
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { Button } from '@/shared/ui/Button'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import {
  getRescueReportById,
  updateReportStage,
  completeReportWithDisposition,
  type RescueReport,
} from '@/features/reports/domain/rescueReports'
import { ReportPipelineTracker } from '@/features/reports/components/ReportPipelineTracker'
import { ReportFactsGrid } from '@/features/reports/components/ReportFactsGrid'
import '@/features/reports/reports.css'

export function ReportDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const db = useDb()

  const [report, setReport] = useState<RescueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadReport = useCallback(async (isInitial = false) => {
    if (!db || !id) return
    if (isInitial) setLoading(true)
    setError(null)
    try {
      const data = await getRescueReportById(db, id)
      setReport(data)
    } catch (err) {
      console.error('Failed to load rescue report', err)
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [db, id])

  useEffect(() => {
    loadReport(true)
  }, [loadReport])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  async function handleStageTransition(stage: 'accepted' | 'dispatched' | 'attended' | 'cancelled') {
    if (!db || !report) return
    setActionLoading(true)
    setIsDropdownOpen(false)
    try {
      await updateReportStage(db, report.id, stage)
      await loadReport()
    } catch (err) {
      console.error(`Failed to update stage to ${stage}`, err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDisposition(disposition: 'spot_released' | 'admitted_shelter') {
    if (!db || !report) return
    setActionLoading(true)
    setIsDispositionModalOpen(false)
    try {
      if (disposition === 'admitted_shelter') {
        const dummyAnimalId = crypto.randomUUID()
        await completeReportWithDisposition(db, report.id, 'admitted_shelter', dummyAnimalId)
      } else {
        await completeReportWithDisposition(db, report.id, 'spot_released', undefined)
      }
      await loadReport()
    } catch (err) {
      console.error(`Failed to complete disposition ${disposition}`, err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="reports-screen">
        <div className="reports-detail-wrap">
          <p className="loading-state">Loading rescue report…</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="reports-screen">
        <div className="reports-detail-wrap">
          <Link to="/reports" className="back-nav-link">
            <CaretLeft size={16} weight="bold" aria-hidden />
            <span>Reports</span>
          </Link>
          <div className="reports-empty-state" style={{ marginTop: '20px' }}>
            <h3>Report Not Found</h3>
            <p>Could not locate emergency report {id}.</p>
          </div>
        </div>
      </div>
    )
  }

  const status = report.status ?? 'logged'
  const disp = report.disposition_type

  // Status badge styling and text
  let statusBadgeLabel = 'New Report (Awaiting Decision)'
  let statusBadgeClass = 'status-badge-clean new'

  if (status === 'accepted') {
    statusBadgeLabel = 'Accepted'
    statusBadgeClass = 'status-badge-clean accepted'
  } else if (status === 'dispatched') {
    statusBadgeLabel = 'Dispatched'
    statusBadgeClass = 'status-badge-clean active'
  } else if (status === 'attended') {
    if (disp === 'spot_released') {
      statusBadgeLabel = 'Spot Released (TNR)'
      statusBadgeClass = 'status-badge-clean shelter'
    } else if (disp === 'admitted_shelter') {
      statusBadgeLabel = 'In Shelter Care'
      statusBadgeClass = 'status-badge-clean shelter'
    } else {
      statusBadgeLabel = 'Attended'
      statusBadgeClass = 'status-badge-clean shelter'
    }
  } else if (status === 'cancelled') {
    statusBadgeLabel = 'Declined / Cancelled'
    statusBadgeClass = 'status-badge-clean declined'
  }

  return (
    <div className="reports-screen">
      <div className="reports-detail-wrap">
        {/* Topbar: Back Link + Stage Action Split Button */}
        <div className="case-detail-topbar">
          <Link to="/reports" className="back-nav-link">
            <CaretLeft size={16} weight="bold" aria-hidden />
            <span>Reports</span>
          </Link>

          <div className="case-top-actions" ref={dropdownRef}>
            {status === 'logged' && (
              <div className="split-btn-group">
                <button
                  type="button"
                  className="btn-brand-amber btn-main pressable"
                  onClick={() => handleStageTransition('accepted')}
                  disabled={actionLoading}
                >
                  <CheckCircle size={16} weight="bold" aria-hidden />
                  <span>Accept &amp; Triage</span>
                </button>
                <button
                  type="button"
                  className="btn-toggle pressable"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  title="More stage actions"
                  aria-label="More stage actions"
                  aria-expanded={isDropdownOpen}
                >
                  <CaretDown size={14} weight="bold" aria-hidden />
                </button>
                {isDropdownOpen && (
                  <div className="dropdown-menu is-open">
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => handleStageTransition('cancelled')}
                    >
                      <XCircle size={15} weight="bold" aria-hidden />
                      <span>Decline / Cancel Report</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'accepted' && (
              <div className="split-btn-group">
                <button
                  type="button"
                  className="btn-brand-amber btn-main pressable"
                  onClick={() => handleStageTransition('dispatched')}
                  disabled={actionLoading}
                >
                  <Truck size={16} weight="bold" aria-hidden />
                  <span>Dispatch Ambulance</span>
                </button>
                <button
                  type="button"
                  className="btn-toggle pressable"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  title="More stage actions"
                  aria-label="More stage actions"
                  aria-expanded={isDropdownOpen}
                >
                  <CaretDown size={14} weight="bold" aria-hidden />
                </button>
                {isDropdownOpen && (
                  <div className="dropdown-menu is-open">
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => handleStageTransition('cancelled')}
                    >
                      <XCircle size={15} weight="bold" aria-hidden />
                      <span>Decline / Cancel Report</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'dispatched' && (
              <div className="split-btn-group">
                <button
                  type="button"
                  className="btn-brand-amber btn-main pressable"
                  onClick={() => handleStageTransition('attended')}
                  disabled={actionLoading}
                >
                  <FirstAid size={16} weight="bold" aria-hidden />
                  <span>Mark Attended</span>
                </button>
                <button
                  type="button"
                  className="btn-toggle pressable"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  title="More stage actions"
                  aria-label="More stage actions"
                  aria-expanded={isDropdownOpen}
                >
                  <CaretDown size={14} weight="bold" aria-hidden />
                </button>
                {isDropdownOpen && (
                  <div className="dropdown-menu is-open">
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => handleStageTransition('cancelled')}
                    >
                      <XCircle size={15} weight="bold" aria-hidden />
                      <span>Cancel Dispatch / Untraceable</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'attended' && !disp && (
              <button
                type="button"
                className="btn-brand-amber pressable"
                onClick={() => setIsDispositionModalOpen(true)}
                disabled={actionLoading}
              >
                <span>Set Disposition</span>
              </button>
            )}

            {status === 'attended' && disp && (
              <div className="completed-actions-row">
                <Button
                  variant="secondary"
                  onClick={() => navigate('/reports')}
                >
                  Back to Reports
                </Button>
                {disp === 'admitted_shelter' && (
                  <Link
                    to={report.animal_id ? `/animals/${report.animal_id}` : '/animals/new'}
                    className="btn-brand-amber pressable"
                    style={{ textDecoration: 'none' }}
                  >
                    <span>Animal Profile &rarr;</span>
                  </Link>
                )}
              </div>
            )}

            {status === 'cancelled' && (
              <Button
                variant="secondary"
                onClick={() => navigate('/reports')}
              >
                Back to Reports
              </Button>
            )}
          </div>
        </div>

        {/* Case Header: Unboxed Report ID with Centered Status Badge in the same row */}
        <div className="case-detail-header-unboxed">
          <h1 className="case-hero-id">{report.report_number}</h1>
          <span className={statusBadgeClass}>{statusBadgeLabel}</span>
        </div>

        {/* 4-Stage Lifecycle Stepper */}
        <ReportPipelineTracker report={report} />

        {/* Interlink Banner if Admitted/Attended */}
        {status === 'attended' && disp === 'admitted_shelter' && (
          <div className="animal-interlink-banner">
            <div className="interlink-badge-icon">
              <HouseSimple size={22} weight="bold" aria-hidden />
            </div>
            <div className="interlink-copy">
              <div className="interlink-title">Report addressed · Animal record registered in Sanctuary</div>
              <div className="interlink-desc">
                Permanent animal record created. Clinical treatments, medications, and shelter care are managed in the Animal registry.
              </div>
            </div>
            <Link
              to={report.animal_id ? `/animals/${report.animal_id}` : '/animals/new'}
              className="btn-primary-forest pressable"
              style={{ textDecoration: 'none' }}
            >
              <span>Open Animal Profile &rarr;</span>
            </Link>
          </div>
        )}

        {/* Intake Facts Grid */}
        <ReportFactsGrid report={report} />
      </div>

      {/* Disposition Modal */}
      <ResponsiveSheetModal
        isOpen={isDispositionModalOpen}
        onClose={() => setIsDispositionModalOpen(false)}
        title="Set Rescue Disposition"
      >
        <div className="disposition-modal-content stack">
          <p className="disposition-modal-desc">
            Choose the outcome for this attended rescue report:
          </p>

          <div className="disposition-options-list">
            <button
              type="button"
              className="disposition-option-card pressable"
              onClick={() => handleDisposition('spot_released')}
            >
              <div className="disposition-option-icon">
                <FirstAid size={20} weight="bold" />
              </div>
              <div className="disposition-option-copy">
                <strong>Spot Release (TNR)</strong>
                <span>Animal treated on site and safely released back into community territory.</span>
              </div>
            </button>

            <button
              type="button"
              className="disposition-option-card pressable"
              onClick={() => handleDisposition('admitted_shelter')}
            >
              <div className="disposition-option-icon">
                <HouseSimple size={20} weight="bold" />
              </div>
              <div className="disposition-option-copy">
                <strong>Admit to Shelter</strong>
                <span>Admit animal into sanctuary facility for inpatient treatment and recovery.</span>
              </div>
            </button>
          </div>

          <div className="responsive-modal__actions" style={{ marginTop: '16px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDispositionModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </ResponsiveSheetModal>
    </div>
  )
}
