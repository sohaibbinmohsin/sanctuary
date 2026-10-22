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
} from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
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
  const navigate = useNavigate()
  const db = useDb()
  const { member } = useCurrentMember()

  const [report, setReport] = useState<RescueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
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
            animalId = await createAnimalFromReport('admitted_shelter')
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
    if (disp === 'spot_released') {
      statusBadgeLabel = isCruelty ? 'Resolved On-Site' : 'Spot Released (TNR)'
      statusBadgeClass = 'status-badge-clean shelter'
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
                      onClick={() => handleStageTransition('cancelled')}
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
                  onClick={() =>
                    isCruelty
                      ? handleStageTransition('dispatched')
                      : handleStageTransition('dispatched', 'ambulance')
                  }
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
                      onClick={() => handleStageTransition('cancelled')}
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
                      className="dropdown-item"
                      onClick={() => handleStageTransition('accepted')}
                    >
                      <ArrowCounterClockwise size={15} weight="bold" aria-hidden />
                      <span>Change decision</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => handleStageTransition('cancelled')}
                    >
                      <XCircle size={15} weight="bold" aria-hidden />
                      <span>{isCruelty ? 'Dismiss / Close Complaint' : 'Cancel Dispatch / Untraceable'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'attended' && (
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
                  <button
                    type="button"
                    className="btn-brand-amber btn-main pressable"
                    onClick={async () => {
                      setActionLoading(true)
                      try {
                        const animalId = await createAnimalFromReport('admitted_shelter')
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
                    disabled={actionLoading}
                  >
                    <HouseSimple size={16} weight="bold" aria-hidden />
                    <span className="btn-text-full">Open Profile &rarr;</span>
                    <span className="btn-text-mobile">Profile &rarr;</span>
                  </button>
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
            )}

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

        {/* 4-Stage Lifecycle Stepper */}
        <ReportPipelineTracker report={report} />

        {/* Intake Facts Grid */}
        <ReportFactsGrid report={report} />
      </div>
    </div>
  )
}
