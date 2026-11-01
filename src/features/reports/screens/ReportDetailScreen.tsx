import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CaretDown,
  CheckCircle,
  Truck,
  FirstAid,
  XCircle,
  HouseSimple,
  User,
  ArrowCounterClockwise,
  PencilSimple,
  MagnifyingGlass,
  Scales,
  Skull,
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  getRescueReportById,
  updateReportStage,
  completeReportWithDisposition,
  updateReportLegalNotes,
  syncReportPhotosToAnimal,
  createAnimalFromRescueReport,
  type RescueReport,
} from '@/features/reports/domain/rescueReports'
import {
  getReportCompletionStatus,
  type ReportCompletionResult,
} from '@/features/reports/domain/reportOutcomes'
import { ReportPipelineTracker } from '@/features/reports/components/ReportPipelineTracker'
import { ReportFactsGrid } from '@/features/reports/components/ReportFactsGrid'
import { LegalActionModal } from '@/features/reports/components/LegalActionModal'
import { DismissReportModal } from '@/features/reports/components/DismissReportModal'
import '@/features/reports/reports.css'

export function ReportDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const db = useDb()
  const { member } = useCurrentMember()

  const [report, setReport] = useState<RescueReport | null>(null)
  const [outcomeStatus, setOutcomeStatus] = useState<ReportCompletionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false)
  const [isLegalEditingOnly, setIsLegalEditingOnly] = useState(false)
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadReport = useCallback(async (isInitial = false) => {
    if (!db || !id) return
    if (isInitial) setLoading(true)
    setError(null)
    try {
      const data = await getRescueReportById(db, id)
      setReport(data)
      if (data) {
        try {
          const outcome = await getReportCompletionStatus(db, data)
          setOutcomeStatus(outcome)
        } catch (err) {
          console.error('Failed to load report outcome status', err)
        }
      }
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

  // Ensure report photos are synced to linked animal record
  useEffect(() => {
    if (!db || !report?.id || !report?.animal_id || !member?.orgId) return
    void syncReportPhotosToAnimal(db, report.id, report.animal_id, member.orgId)
  }, [db, report?.id, report?.animal_id, member?.orgId])

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

  async function handleMarkDOA() {
    if (!db || !report) return
    setActionLoading(true)
    setIsDropdownOpen(false)
    try {
      await completeReportWithDisposition(db, report.id, 'deceased_doa')
      await loadReport()
    } catch (err) {
      console.error('Failed to mark report DOA', err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleStageTransition(
    stage: 'logged' | 'accepted' | 'dispatched' | 'attended' | 'cancelled',
    transportType?: 'ambulance' | 'reporter',
  ) {
    if (!db || !report) return
    setActionLoading(true)
    setIsDropdownOpen(false)
    try {
      if (stage === 'attended') {
        let animalId = report.animal_id
        if (!animalId) {
          try {
            animalId = await createAnimalFromRescueReport(db, report, {
              orgId: report.org_id || member?.orgId,
              orgInitials: member?.orgInitials,
              disposition: 'admitted_shelter',
            })
          } catch (animalErr) {
            console.error('Failed to automatically create animal record', animalErr)
          }
        }
        await completeReportWithDisposition(
          db,
          report.id,
          'admitted_shelter',
          animalId || undefined,
        )
      } else {
        if (transportType !== undefined) {
          await updateReportStage(db, report.id, stage, transportType)
        } else {
          await updateReportStage(db, report.id, stage)
        }
      }
      await loadReport()
    } catch (err) {
      console.error(`Failed to update stage to ${stage}`, err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="reports-screen" aria-busy="true">
        <div className="reports-detail-wrap">
          <div className="case-detail-topbar">
            <Link to="/reports" className="back-link">
              <ArrowLeft size={18} weight="bold" aria-hidden />
              <span>Reports</span>
            </Link>
            <div className="skeleton" style={{ width: '9rem', height: '2.75rem' }} />
          </div>
          <div className="case-detail-header-unboxed">
            <div className="skeleton" style={{ width: '10rem', height: '2.25rem' }} />
            <div className="skeleton" style={{ width: '8rem', height: '1.75rem', borderRadius: '999px' }} />
          </div>
          <div className="skeleton" style={{ width: '100%', height: '5rem', marginBottom: '1.25rem' }} />
          <div className="report-facts-grid">
            <div className="skeleton" style={{ height: '11rem' }} />
            <div className="skeleton" style={{ height: '11rem' }} />
            <div className="skeleton" style={{ height: '9rem' }} />
            <div className="skeleton" style={{ height: '9rem' }} />
          </div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="reports-screen">
        <div className="reports-detail-wrap">
          <Link to="/reports" className="back-link">
            <ArrowLeft size={18} weight="bold" aria-hidden />
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
  const isCruelty = report.category === 'cruelty'

  // Status badge styling and text
  let statusBadgeLabel = isCruelty
    ? 'New Complaint (Awaiting Investigation)'
    : 'New Report (Awaiting Decision)'
  let statusBadgeClass = 'status-badge-clean new'

  if (status === 'accepted') {
    statusBadgeLabel = isCruelty ? 'Under Investigation' : 'Accepted'
    statusBadgeClass = 'status-badge-clean accepted'
  } else if (status === 'dispatched') {
    if (isCruelty) {
      statusBadgeLabel = 'Notice / Legal Action'
      statusBadgeClass = 'status-badge-clean active'
    } else {
      statusBadgeLabel =
        report.transport_type === 'reporter'
          ? 'Dispatched (Reporter Transport)'
          : 'Dispatched (Ambulance)'
      statusBadgeClass = 'status-badge-clean active'
    }
  } else if (status === 'attended') {
    if (disp === 'deceased_doa') {
      statusBadgeLabel = 'Dead on Arrival (DOA)'
      statusBadgeClass = 'status-badge-clean declined'
    } else if (outcomeStatus?.isCompleted) {
      if (disp === 'spot_released') {
        statusBadgeLabel = isCruelty ? 'Resolved On-Site' : 'Spot Released (TNR)'
      } else {
        statusBadgeLabel = outcomeStatus.outcomeLabel || 'Completed'
      }
      statusBadgeClass = 'status-badge-clean completed'
    } else if (disp === 'spot_released') {
      statusBadgeLabel = isCruelty ? 'Resolved On-Site' : 'Spot Released (TNR)'
      statusBadgeClass = 'status-badge-clean completed'
    } else if (disp === 'admitted_shelter') {
      statusBadgeLabel = isCruelty ? 'In Shelter Custody' : 'In Shelter Care'
      statusBadgeClass = 'status-badge-clean shelter'
    } else {
      statusBadgeLabel = isCruelty ? 'In Custody' : 'Attended'
      statusBadgeClass = 'status-badge-clean shelter'
    }
  } else if (status === 'cancelled') {
    statusBadgeLabel = isCruelty ? 'Dismissed / Closed' : 'Declined / Cancelled'
    statusBadgeClass = 'status-badge-clean declined'
  }

  return (
    <div className="reports-screen">
      <div className="reports-detail-wrap">
        {/* Topbar: Back Link + Stage Action Split Button */}
        <div className="case-detail-topbar">
          <Link to="/reports" className="back-link">
            <ArrowLeft size={18} weight="bold" aria-hidden />
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
                  {isCruelty ? (
                    <MagnifyingGlass size={16} weight="bold" aria-hidden />
                  ) : (
                    <CheckCircle size={16} weight="bold" aria-hidden />
                  )}
                  <span className="btn-text-full">
                    {isCruelty ? 'Begin Investigation' : 'Accept & Triage'}
                  </span>
                  <span className="btn-text-mobile">
                    {isCruelty ? 'Investigate' : 'Accept'}
                  </span>
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
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        navigate(`/reports/${report.id}/edit`)
                      }}
                    >
                      <PencilSimple size={15} weight="bold" aria-hidden />
                      <span>Edit report</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        setIsDismissModalOpen(true)
                      }}
                    >
                      <XCircle size={15} weight="bold" aria-hidden />
                      <span>{isCruelty ? 'Dismiss / Close Complaint' : 'Decline / Cancel Report'}</span>
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
                  onClick={() => {
                    if (isCruelty) {
                      setIsLegalEditingOnly(false)
                      setIsLegalModalOpen(true)
                    } else {
                      handleStageTransition('dispatched', 'ambulance')
                    }
                  }}
                  disabled={actionLoading}
                >
                  {isCruelty ? (
                    <Scales size={16} weight="bold" aria-hidden />
                  ) : (
                    <Truck size={16} weight="bold" aria-hidden />
                  )}
                  <span className="btn-text-full">
                    {isCruelty ? 'Log Notice / Legal Action' : 'Dispatch Ambulance'}
                  </span>
                  <span className="btn-text-mobile">
                    {isCruelty ? 'Legal Action' : 'Dispatch'}
                  </span>
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
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        navigate(`/reports/${report.id}/edit`)
                      }}
                    >
                      <PencilSimple size={15} weight="bold" aria-hidden />
                      <span>Edit report</span>
                    </button>
                    {!isCruelty && (
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => handleStageTransition('dispatched', 'reporter')}
                      >
                        <User size={15} weight="bold" aria-hidden />
                        <span>Reporter Arranging Transport</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleStageTransition('logged')}
                    >
                      <ArrowCounterClockwise size={15} weight="bold" aria-hidden />
                      <span>Change decision</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        setIsDismissModalOpen(true)
                      }}
                    >
                      <XCircle size={15} weight="bold" aria-hidden />
                      <span>{isCruelty ? 'Dismiss / Close Complaint' : 'Decline / Cancel Report'}</span>
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
                  {isCruelty ? (
                    <HouseSimple size={16} weight="bold" aria-hidden />
                  ) : (
                    <FirstAid size={16} weight="bold" aria-hidden />
                  )}
                  <span className="btn-text-full">
                    {isCruelty ? 'Take into Custody' : 'Mark Attended'}
                  </span>
                  <span className="btn-text-mobile">
                    {isCruelty ? 'In Custody' : 'Attended'}
                  </span>
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
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        navigate(`/reports/${report.id}/edit`)
                      }}
                    >
                      <PencilSimple size={15} weight="bold" aria-hidden />
                      <span>Edit report</span>
                    </button>
                    {isCruelty && (
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={async () => {
                          if (!db || !report) return
                          setActionLoading(true)
                          setIsDropdownOpen(false)
                          try {
                            await completeReportWithDisposition(db, report.id, 'spot_released')
                            await loadReport()
                          } catch (err) {
                            console.error('Failed to resolve cruelty case on site', err)
                          } finally {
                            setActionLoading(false)
                          }
                        }}
                      >
                        <CheckCircle size={15} weight="bold" aria-hidden />
                        <span>Resolve On-Site</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={handleMarkDOA}
                    >
                      <Skull size={15} weight="bold" aria-hidden />
                      <span>Dead on Arrival</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleStageTransition('accepted')}
                    >
                      <ArrowCounterClockwise size={15} weight="bold" aria-hidden />
                      <span>Change decision</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        setIsDismissModalOpen(true)
                      }}
                    >
                      <XCircle size={15} weight="bold" aria-hidden />
                      <span>{isCruelty ? 'Dismiss / Close Complaint' : 'Cancel Dispatch / Untraceable'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'attended' && disp === 'deceased_doa' ? (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="pressable"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  aria-expanded={isDropdownOpen}
                  title="More stage actions"
                  aria-label="Dead on Arrival stage actions"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--color-surface)',
                    color: 'var(--color-ink-muted)',
                    border: '1px solid var(--color-border)',
                    height: '44px',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <Skull size={16} weight="bold" aria-hidden />
                  <span className="btn-text-full">Dead on Arrival</span>
                  <span className="btn-text-mobile">DOA</span>
                  <CaretDown size={14} weight="bold" aria-hidden style={{ marginLeft: '4px', opacity: 0.7 }} />
                </button>
                {isDropdownOpen && (
                  <div className="dropdown-menu is-open">
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        navigate(`/reports/${report.id}/edit`)
                      }}
                    >
                      <PencilSimple size={15} weight="bold" aria-hidden />
                      <span>Edit report</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleStageTransition('dispatched')}
                    >
                      <ArrowCounterClockwise size={15} weight="bold" aria-hidden />
                      <span>Change decision</span>
                    </button>
                  </div>
                )}
              </div>
            ) : status === 'attended' ? (
              <div className="split-btn-group">
                {report.animal_id ? (
                  <Link
                    to={`/animals/${report.animal_id}`}
                    className="btn-brand-amber btn-main pressable"
                    style={{
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <HouseSimple size={16} weight="bold" aria-hidden />
                    <span className="btn-text-full">Open Profile &rarr;</span>
                    <span className="btn-text-mobile">Profile &rarr;</span>
                  </Link>
                ) : (
                  <div
                    className="btn-brand-amber btn-main"
                    style={{
                      cursor: 'default',
                      opacity: 0.9,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle size={16} weight="bold" aria-hidden />
                    <span>Case Attended</span>
                  </div>
                )}
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
                    {!report.animal_id && (
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={async () => {
                          setIsDropdownOpen(false)
                          setActionLoading(true)
                          try {
                            const animalId = await createAnimalFromRescueReport(db, report, {
                              orgId: report.org_id || member?.orgId,
                              orgInitials: member?.orgInitials,
                              disposition: 'admitted_shelter',
                            })
                            await completeReportWithDisposition(
                              db,
                              report.id,
                              'admitted_shelter',
                              animalId,
                            )
                            await loadReport()
                          } catch (err) {
                            console.error('Failed to create animal profile', err)
                          } finally {
                            setActionLoading(false)
                          }
                        }}
                      >
                        <HouseSimple size={15} weight="bold" aria-hidden />
                        <span>Admit to shelter</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        navigate(`/reports/${report.id}/edit`)
                      }}
                    >
                      <PencilSimple size={15} weight="bold" aria-hidden />
                      <span>Edit report</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleStageTransition('dispatched')}
                    >
                      <ArrowCounterClockwise size={15} weight="bold" aria-hidden />
                      <span>Change decision</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {status === 'cancelled' && (
              <div className="split-btn-group">
                <button
                  type="button"
                  className="btn-brand-amber btn-main pressable"
                  onClick={() => handleStageTransition('logged')}
                  disabled={actionLoading}
                >
                  <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
                  <span className="btn-text-full">
                    {isCruelty ? 'Reopen Complaint' : 'Reopen as Logged'}
                  </span>
                  <span className="btn-text-mobile">Reopen</span>
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
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        navigate(`/reports/${report.id}/edit`)
                      }}
                    >
                      <PencilSimple size={15} weight="bold" aria-hidden />
                      <span>Edit report</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleStageTransition('accepted')}
                    >
                      <CheckCircle size={15} weight="bold" aria-hidden />
                      <span>
                        {isCruelty ? 'Reopen as Investigating' : 'Reopen as Accepted'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Case Header: Unboxed Report ID with Centered Status Badge in the same row */}
        <div className="case-detail-header-unboxed">
          <h1 className="case-hero-id">{report.report_number}</h1>
          <span className={statusBadgeClass}>{statusBadgeLabel}</span>
        </div>

        {/* Lifecycle Stepper */}
        <ReportPipelineTracker
          report={report}
          outcomeStatus={outcomeStatus}
          onStepClick={(stepNumber) => {
            if (isCruelty && status === 'accepted' && stepNumber === 3) {
              setIsLegalEditingOnly(false)
              setIsLegalModalOpen(true)
            }
          }}
        />

        {/* Intake Facts Grid */}
        <ReportFactsGrid report={report} />

        {/* Legal Action Modal */}
        <LegalActionModal
          isOpen={isLegalModalOpen}
          onClose={() => setIsLegalModalOpen(false)}
          initialNotes={report.legal_notes}
          isEditingOnly={isLegalEditingOnly}
          onSave={async (notes) => {
            if (!db || !report) return
            setActionLoading(true)
            try {
              if (isLegalEditingOnly) {
                await updateReportLegalNotes(db, report.id, notes)
              } else {
                await updateReportStage(db, report.id, 'dispatched', { legalNotes: notes })
              }
              await loadReport()
            } catch (err) {
              console.error('Failed to save legal action notes', err)
            } finally {
              setActionLoading(false)
            }
          }}
        />

        {/* Dismiss / Cancel Report Modal */}
        <DismissReportModal
          isOpen={isDismissModalOpen}
          onClose={() => setIsDismissModalOpen(false)}
          isCruelty={isCruelty}
          onConfirm={async (reason) => {
            if (!db || !report) return
            setActionLoading(true)
            try {
              await updateReportStage(db, report.id, 'cancelled', { dismissalReason: reason })
              await loadReport()
            } catch (err) {
              console.error('Failed to dismiss report', err)
            } finally {
              setActionLoading(false)
            }
          }}
        />
      </div>
    </div>
  )
}
