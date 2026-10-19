import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CaretLeft,
  CaretDown,
  CheckCircle,
  Truck,
  FirstAid,
  XCircle,
  HouseSimple,
  User,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { Button } from '@/shared/ui/Button'
import { ResponsiveSheetModal } from '@/shared/ui/ResponsiveSheetModal'
import {
  getRescueReportById,
  updateReportStage,
  completeReportWithDisposition,
  getPhotosForReport,
  type RescueReport,
} from '@/features/reports/domain/rescueReports'
import { createAnimal } from '@/features/animals/domain/animals'
import { listStatuses } from '@/features/statuses/domain/statuses'
import { ReportPipelineTracker } from '@/features/reports/components/ReportPipelineTracker'
import { ReportFactsGrid } from '@/features/reports/components/ReportFactsGrid'
import '@/features/reports/reports.css'

export function ReportDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const { member } = useCurrentMember()

  const [report, setReport] = useState<RescueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false)
  const [isChangeDecisionOpen, setIsChangeDecisionOpen] = useState(false)
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

  async function handleStageTransition(
    stage: 'accepted' | 'dispatched' | 'attended' | 'cancelled',
    transportType?: 'ambulance' | 'reporter',
  ) {
    if (!db || !report) return
    setActionLoading(true)
    setIsDropdownOpen(false)
    try {
      if (transportType !== undefined) {
        await updateReportStage(db, report.id, stage, transportType)
      } else {
        await updateReportStage(db, report.id, stage)
      }
      await loadReport()
    } catch (err) {
      console.error(`Failed to update stage to ${stage}`, err)
    } finally {
      setActionLoading(false)
    }
  }

  async function createAnimalFromReport(
    disposition: 'spot_released' | 'admitted_shelter',
  ): Promise<string> {
    if (!db || !report) throw new Error('Database or report not available')

    const orgId = report.org_id || member?.orgId
    if (!orgId) throw new Error('Organization ID is missing')

    const prefix = member?.orgInitials || report.report_number?.split('-')[0] || 'MS'
    let targetStatusId: string | null = null

    try {
      const statuses = await listStatuses(db, orgId)
      if (disposition === 'spot_released') {
        const released = statuses.find((s) => s.label.toLowerCase() === 'released')
        targetStatusId = released?.id ?? statuses[0]?.id ?? null
      } else {
        const inCare = statuses.find(
          (s) => s.label.toLowerCase() === 'intake' || s.counts_as_in_care === 1,
        )
        targetStatusId = inCare?.id ?? statuses[0]?.id ?? null
      }
    } catch (err) {
      console.warn('Could not load statuses for report animal intake', err)
    }

    const notesText = [
      `Rescue report: ${report.report_number || ''}`,
      report.chief_complaint ? `Complaint: ${report.chief_complaint}` : null,
      report.reporter_name
        ? `Reporter: ${report.reporter_name}${report.reporter_phone ? ` (${report.reporter_phone})` : ''}`
        : null,
    ]
      .filter(Boolean)
      .join('\n')

    const markingsText = report.location_landmark
      ? `${report.location_area || ''} (near ${report.location_landmark})`.trim()
      : report.location_area || undefined

    const animal = await createAnimal(db, {
      orgId,
      prefix,
      species: report.species || 'other',
      statusIds: targetStatusId ? [targetStatusId] : ['status-intake'],
      notes: notesText,
      markings: markingsText,
      intakeDate: new Date().toISOString().slice(0, 10),
    })

    // Transfer report photos to animal photos table
    try {
      const reportPhotos = await getPhotosForReport(db, report.id)
      const now = new Date().toISOString()
      for (const p of reportPhotos) {
        await db.execute(
          `INSERT INTO photos (id, org_id, animal_id, r2_key, local_only, upload_state, capture_source, verified, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [
            crypto.randomUUID(),
            orgId,
            animal.id,
            p.r2_key,
            p.local_only,
            p.upload_state,
            'upload',
            p.created_at || now,
          ],
        )
      }
    } catch (photoErr) {
      console.warn('Could not copy report photos to animal', photoErr)
    }

    return animal.id
  }

  async function handleDisposition(disposition: 'spot_released' | 'admitted_shelter') {
    if (!db || !report) return
    setActionLoading(true)
    setIsDispositionModalOpen(false)
    try {
      let animalId = report.animal_id
      if (!animalId) {
        try {
          animalId = await createAnimalFromReport(disposition)
        } catch (animalErr) {
          console.error('Failed to automatically create animal record', animalErr)
        }
      }
      await completeReportWithDisposition(db, report.id, disposition, animalId || undefined)
      await loadReport()
    } catch (err) {
      console.error(`Failed to complete disposition ${disposition}`, err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChangeDecisionStage(
    stage: 'logged' | 'accepted' | 'dispatched' | 'cancelled',
    transportType?: 'ambulance' | 'reporter',
  ) {
    if (!db || !report) return
    setActionLoading(true)
    setIsChangeDecisionOpen(false)
    try {
      if (transportType !== undefined) {
        await updateReportStage(db, report.id, stage, transportType)
      } else {
        await updateReportStage(db, report.id, stage)
      }
      await loadReport()
    } catch (err) {
      console.error(`Failed to change decision stage to ${stage}`, err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChangeDecisionDisposition(disposition: 'spot_released' | 'admitted_shelter') {
    setIsChangeDecisionOpen(false)
    await handleDisposition(disposition)
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
    statusBadgeLabel =
      report.transport_type === 'reporter'
        ? 'Dispatched (Reporter Transport)'
        : 'Dispatched (Ambulance)'
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
              <div
                className="accepted-actions-group"
                style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}
              >
                <div className="split-btn-group">
                  <button
                    type="button"
                    className="btn-brand-amber btn-main pressable"
                    onClick={() => handleStageTransition('dispatched', 'ambulance')}
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
                        className="dropdown-item"
                        onClick={() => handleStageTransition('dispatched', 'reporter')}
                      >
                        <User size={15} weight="bold" aria-hidden />
                        <span>Reporter Arranging Transport</span>
                      </button>
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

                <button
                  type="button"
                  className="btn-brand-outline pressable"
                  onClick={() => handleStageTransition('dispatched', 'reporter')}
                  disabled={actionLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgb(222, 107, 43)',
                    color: 'rgb(222, 107, 43)',
                    background: 'transparent',
                    cursor: 'pointer',
                    minHeight: 'var(--touch-min)',
                  }}
                >
                  <User size={16} weight="bold" aria-hidden />
                  <span>Reporter Arranging Transport</span>
                </button>
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
                  onClick={() => setIsChangeDecisionOpen(true)}
                >
                  <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
                  <span>Change decision</span>
                </Button>
                {report.animal_id && (
                  <Link
                    to={`/animals/${report.animal_id}`}
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
                onClick={() => setIsChangeDecisionOpen(true)}
              >
                <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
                <span>Change decision</span>
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

      {/* Change Decision Modal */}
      <ResponsiveSheetModal
        isOpen={isChangeDecisionOpen}
        onClose={() => setIsChangeDecisionOpen(false)}
        title="Change Decision"
      >
        <div className="stack stack--loose">
          <p className="field__hint" style={{ marginTop: '-4px', marginBottom: '8px' }}>
            Update pipeline status for {report.report_number}
          </p>
          <div className="field">
            <span>Select new stage or decision:</span>
            <div className="stack stack--tight" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn--secondary btn--block"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
                onClick={() => handleChangeDecisionStage('logged')}
              >
                <strong>Reopen as Logged</strong> &nbsp;—&nbsp; Awaiting triage decision
              </button>

              <button
                type="button"
                className="btn btn--secondary btn--block"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
                onClick={() => handleChangeDecisionStage('accepted')}
              >
                <strong>Accepted</strong> &nbsp;—&nbsp; Triage accepted, awaiting transport
              </button>

              <button
                type="button"
                className="btn btn--secondary btn--block"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
                onClick={() => handleChangeDecisionStage('dispatched', 'ambulance')}
              >
                <strong>Dispatch Ambulance</strong> &nbsp;—&nbsp; Field team en route
              </button>

              <button
                type="button"
                className="btn btn--secondary btn--block"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
                onClick={() => handleChangeDecisionStage('dispatched', 'reporter')}
              >
                <strong>Reporter Arranging Transport</strong> &nbsp;—&nbsp; Reporter bringing animal
              </button>

              <button
                type="button"
                className="btn btn--secondary btn--block"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
                onClick={() => handleChangeDecisionDisposition('spot_released')}
              >
                <strong>Spot Release (TNR)</strong> &nbsp;—&nbsp; Treated on spot / returned
              </button>

              <button
                type="button"
                className="btn btn--secondary btn--block"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
                onClick={() => handleChangeDecisionDisposition('admitted_shelter')}
              >
                <strong>Admit to Shelter</strong> &nbsp;—&nbsp; In sanctuary / shelter care
              </button>

              <button
                type="button"
                className="btn btn--danger btn--block"
                style={{
                  justifyContent: 'flex-start',
                  padding: '12px 16px',
                  marginTop: '8px',
                  textAlign: 'left',
                }}
                onClick={() => handleChangeDecisionStage('cancelled')}
              >
                <strong>Decline / Cancel Report</strong> &nbsp;—&nbsp; Untraceable or out of scope
              </button>
            </div>
          </div>

          <div className="responsive-modal__actions" style={{ marginTop: '16px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsChangeDecisionOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </ResponsiveSheetModal>
    </div>
  )
}
