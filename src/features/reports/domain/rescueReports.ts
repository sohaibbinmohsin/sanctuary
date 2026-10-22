import type { SanctuaryDb } from '@/shared/lib/db'
import {
  AppSchema,
  type RescueReportRecord,
  type ReportPhotoRecord,
} from '@/features/sync/powersync/schema'
import { compressImage } from '@/shared/lib/r2/upload'
import { storeLocalPhoto } from '@/features/photos/domain/photos'

export type RescueReportStage =
  | 'logged'
  | 'accepted'
  | 'dispatched'
  | 'attended'
  | 'cancelled'

export type RescueReportDisposition =
  | 'spot_released'
  | 'transferred_partner'
  | 'admitted_shelter'

export type RescueReportFilter = 'all' | 'new' | 'in_progress' | 'completed'

export type RescueReport = RescueReportRecord
export type ReportPhoto = ReportPhotoRecord

export type CreateRescueReportInput = {
  orgId: string
  reportNumber: string
  category?: string
  species: string
  lifeStage?: 'adult' | 'child' | null
  chiefComplaint: string
  city?: string | null
  locationArea: string
  locationLandmark?: string | null
  latitude?: number | null
  longitude?: number | null
  reporterName?: string | null
  reporterPhone?: string | null
  reporterCnic?: string | null
}

/**
 * Generates sequential human-readable emergency report numbers.
 * Format: `<ORG_INITIALS>-R<101 + count>` (e.g. `PARC-R101`, `PARC-R106`).
 */
export async function generateReportNumber(
  db: SanctuaryDb,
  orgInitials: string,
): Promise<string> {
  const prefix = orgInitials.trim().toUpperCase()
  try {
    if (typeof db.getAll === 'function') {
      const rows = await db.getAll<{ report_number: string }>(
        `SELECT report_number FROM rescue_reports WHERE report_number LIKE ?`,
        [`${prefix}-R%`],
      )
      if (Array.isArray(rows)) {
        const re = new RegExp(`^${prefix}-R(\\d+)$`, 'i')
        let max = 100
        for (const row of rows) {
          const m = row.report_number?.match(re)
          if (m) {
            const num = parseInt(m[1], 10)
            if (!isNaN(num) && num > max) {
              max = num
            }
          }
        }
        return `${prefix}-R${max + 1}`
      }
    }
  } catch {
    // fallback if query fails
  }

  // Fallback for mock environments that only mock getOptional
  const row = await db.getOptional<{ count: number }>(
    `SELECT COUNT(*) as count FROM rescue_reports`,
  ).catch(() => null)

  const count = row?.count ?? 0
  return `${prefix}-R${101 + count}`
}

export type UpdateReportStageOptions = {
  transportType?: 'ambulance' | 'reporter' | null
  legalNotes?: string | null
  dismissalReason?: string | null
}

export async function getExistingColumns(db: SanctuaryDb, tableName: string): Promise<Set<string>> {
  try {
    if (typeof db.getAll === 'function') {
      const rows = await db.getAll<{ name: string }>(`PRAGMA table_info(${tableName})`)
      if (Array.isArray(rows) && rows.length > 0) {
        return new Set(rows.map((r) => r.name))
      }
    }
  } catch {}
  return new Set()
}

export async function ensureReportColumns(db: SanctuaryDb): Promise<void> {
  try {
    const cols = await getExistingColumns(db, 'rescue_reports')
    if (
      cols.has('reporter_cnic') &&
      cols.has('legal_notes') &&
      cols.has('dismissal_reason') &&
      cols.has('latitude') &&
      cols.has('longitude') &&
      cols.has('city') &&
      cols.has('life_stage')
    ) {
      return
    }

    if (typeof db.execute === 'function') {
      try {
        await db.execute('SELECT powersync_replace_schema(?)', [JSON.stringify(AppSchema.toJSON())])
      } catch {
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN legal_notes TEXT`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN dismissal_reason TEXT`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN reporter_cnic TEXT`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN latitude REAL`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN longitude REAL`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN city TEXT`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN life_stage TEXT`).catch(() => {})
      }
    }
  } catch (err) {
    console.warn('ensureReportColumns error', err)
  }
}

/**
 * Creates an emergency rescue report in the database with status 'logged'.
 * Citizen reporter information is recorded internally/confidentially.
 */
export async function createRescueReport(
  db: SanctuaryDb,
  input: CreateRescueReportInput,
): Promise<RescueReport> {
  await ensureReportColumns(db)
  const cols = await getExistingColumns(db, 'rescue_reports')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const report: RescueReport = {
    id,
    org_id: input.orgId,
    report_number: input.reportNumber.trim(),
    category: input.category?.trim() || 'emergency',
    species: input.species.trim(),
    life_stage: input.lifeStage ?? 'adult',
    chief_complaint: input.chiefComplaint.trim(),
    status: 'logged',
    city: input.city?.trim() || 'Lahore',
    location_area: input.locationArea.trim(),
    location_landmark: input.locationLandmark?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    reporter_name: input.reporterName?.trim() || null,
    reporter_phone: input.reporterPhone?.trim() || null,
    reporter_cnic: input.reporterCnic?.trim() || null,
    transport_type: null,
    disposition_type: null,
    animal_id: null,
    legal_notes: null,
    dismissal_reason: null,
    stage_logged_at: now,
    stage_accepted_at: null,
    stage_dispatched_at: null,
    stage_attended_at: null,
    created_at: now,
    updated_at: now,
  }

  const recordMap: Record<string, any> = {
    id: report.id,
    org_id: report.org_id,
    report_number: report.report_number,
    category: report.category,
    species: report.species,
    life_stage: report.life_stage,
    chief_complaint: report.chief_complaint,
    status: report.status,
    city: report.city,
    location_area: report.location_area,
    location_landmark: report.location_landmark,
    latitude: report.latitude,
    longitude: report.longitude,
    reporter_name: report.reporter_name,
    reporter_phone: report.reporter_phone,
    reporter_cnic: report.reporter_cnic,
    transport_type: report.transport_type,
    disposition_type: report.disposition_type,
    animal_id: report.animal_id,
    legal_notes: report.legal_notes,
    dismissal_reason: report.dismissal_reason,
    stage_logged_at: report.stage_logged_at,
    stage_accepted_at: report.stage_accepted_at,
    stage_dispatched_at: report.stage_dispatched_at,
    stage_attended_at: report.stage_attended_at,
    created_at: report.created_at,
    updated_at: report.updated_at,
  }

  const insertCols = Object.keys(recordMap).filter((k) => cols.size === 0 || cols.has(k))
  const placeholders = insertCols.map(() => '?').join(', ')
  const values = insertCols.map((k) => recordMap[k])

  await db.execute(
    `INSERT INTO rescue_reports (${insertCols.join(', ')}) VALUES (${placeholders})`,
    values,
  )

  return report
}

/**
 * Updates report stage along with recording the respective stage timestamp.
 * Allows passing transportType or UpdateReportStageOptions containing legalNotes or dismissalReason.
 */
export async function updateReportStage(
  db: SanctuaryDb,
  reportId: string,
  stage: RescueReportStage,
  transportTypeOrOptions?: 'ambulance' | 'reporter' | null | UpdateReportStageOptions,
): Promise<void> {
  await ensureReportColumns(db)
  const now = new Date().toISOString()
  let stageColumn: string | null = null

  if (stage === 'logged') stageColumn = 'stage_logged_at'
  else if (stage === 'accepted') stageColumn = 'stage_accepted_at'
  else if (stage === 'dispatched') stageColumn = 'stage_dispatched_at'
  else if (stage === 'attended') stageColumn = 'stage_attended_at'

  const options: UpdateReportStageOptions =
    typeof transportTypeOrOptions === 'object' && transportTypeOrOptions !== null
      ? transportTypeOrOptions
      : { transportType: transportTypeOrOptions }

  const cols = await getExistingColumns(db, 'rescue_reports')
  const setClauses: string[] = ['status = ?', 'updated_at = ?']
  const params: any[] = [stage, now]

  if (stageColumn) {
    setClauses.push(`${stageColumn} = ?`)
    params.push(now)
  }

  if (options.transportType !== undefined) {
    setClauses.push('transport_type = ?')
    params.push(options.transportType)
  }

  if (options.legalNotes !== undefined && (cols.size === 0 || cols.has('legal_notes'))) {
    setClauses.push('legal_notes = ?')
    params.push(options.legalNotes)
  }

  if (options.dismissalReason !== undefined && (cols.size === 0 || cols.has('dismissal_reason'))) {
    setClauses.push('dismissal_reason = ?')
    params.push(options.dismissalReason)
  }

  if (stage !== 'attended') {
    setClauses.push('disposition_type = NULL')
  }

  params.push(reportId)

  await db.execute(
    `UPDATE rescue_reports
     SET ${setClauses.join(', ')}
     WHERE id = ?`,
    params,
  )
}

/**
 * Updates existing legal notes for a report.
 */
export async function updateReportLegalNotes(
  db: SanctuaryDb,
  reportId: string,
  legalNotes: string,
): Promise<void> {
  await ensureReportColumns(db)
  const now = new Date().toISOString()
  await db.execute(
    `UPDATE rescue_reports SET legal_notes = ?, updated_at = ? WHERE id = ?`,
    [legalNotes.trim(), now, reportId],
  )
}

/**
 * Deduplicates any legacy duplicate report_number records in local SQLite.
 */
export async function deduplicateReportNumbers(db: SanctuaryDb, orgId: string): Promise<void> {
  try {
    if (typeof db.getAll !== 'function') return
    const reports = await db.getAll<{ id: string; report_number: string; created_at: string }>(
      `SELECT id, report_number, created_at FROM rescue_reports WHERE org_id = ? ORDER BY created_at ASC`,
      [orgId],
    )
    if (!reports || reports.length < 2) return

    const seen = new Set<string>()
    const prefix = reports[0]?.report_number?.split('-')[0] || 'MS'
    let maxSeq = 100
    for (const r of reports) {
      const m = r.report_number?.match(new RegExp(`^${prefix}-R(\\d+)$`, 'i'))
      if (m) {
        const seq = parseInt(m[1], 10)
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
      }
    }

    for (const r of reports) {
      if (seen.has(r.report_number)) {
        maxSeq += 1
        const newCode = `${prefix}-R${maxSeq}`
        await db.execute(`UPDATE rescue_reports SET report_number = ? WHERE id = ?`, [newCode, r.id])
      } else {
        seen.add(r.report_number)
      }
    }
  } catch (err) {
    console.warn('deduplicateReportNumbers error', err)
  }
}

/**
 * Completes a report with an attended disposition (spot release, transfer to partner, or admitted to shelter),
 * or clears disposition if null is provided.
 */
export async function completeReportWithDisposition(
  db: SanctuaryDb,
  reportId: string,
  disposition: RescueReportDisposition | null,
  animalId?: string,
): Promise<void> {
  const now = new Date().toISOString()

  await db.execute(
    `UPDATE rescue_reports
     SET status = ?, disposition_type = ?, animal_id = COALESCE(?, animal_id), stage_attended_at = COALESCE(stage_attended_at, ?), updated_at = ?
     WHERE id = ?`,
    ['attended', disposition, animalId || null, now, now, reportId],
  )
}

/**
 * Retrieves rescue reports for an organization, optionally filtered by status category.
 */
export async function getRescueReports(
  db: SanctuaryDb,
  orgId: string,
  filter?: RescueReportFilter,
): Promise<RescueReport[]> {
  await deduplicateReportNumbers(db, orgId)
  let filterClause = ''
  if (filter === 'new') {
    filterClause = ` AND status = 'logged'`
  } else if (filter === 'in_progress') {
    filterClause = ` AND status IN ('accepted', 'dispatched')`
  } else if (filter === 'completed') {
    filterClause = ` AND status IN ('attended', 'cancelled')`
  }

  const sql = `SELECT * FROM rescue_reports WHERE org_id = ?${filterClause} ORDER BY created_at DESC`
  return db.getAll<RescueReport>(sql, [orgId])
}

/**
 * Retrieves a single rescue report by its ID.
 */
export async function getRescueReportById(
  db: SanctuaryDb,
  reportId: string,
): Promise<RescueReport | null> {
  return db.getOptional<RescueReport>(
    `SELECT * FROM rescue_reports WHERE id = ?`,
    [reportId],
  )
}

/**
 * Attaches a proof/evidence photo to a rescue report and stores compressed blob locally.
 */
export async function addReportPhoto(
  db: SanctuaryDb,
  input: {
    orgId: string
    reportId: string
    blob: Blob
  },
): Promise<ReportPhoto> {
  const compressed = await compressImage(input.blob)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await storeLocalPhoto(id, compressed)
  await db.execute(
    `INSERT INTO report_photos (id, org_id, report_id, r2_key, local_only, upload_state, created_at)
     VALUES (?, ?, ?, NULL, 1, 'pending', ?)`,
    [id, input.orgId, input.reportId, now],
  )
  return {
    id,
    org_id: input.orgId,
    report_id: input.reportId,
    r2_key: null,
    local_only: 1,
    upload_state: 'pending',
    created_at: now,
  }
}

/**
 * Lists all photos attached to a rescue report.
 */
export async function getPhotosForReport(
  db: SanctuaryDb,
  reportId: string,
): Promise<ReportPhoto[]> {
  if (!db || typeof db.getAll !== 'function') {
    return []
  }
  return db.getAll<ReportPhoto>(
    `SELECT * FROM report_photos WHERE report_id = ? ORDER BY created_at ASC`,
    [reportId],
  )
}

export type UpdateRescueReportInput = {
  category?: string
  species?: string
  lifeStage?: 'adult' | 'child' | null
  chiefComplaint?: string
  city?: string | null
  locationArea?: string
  locationLandmark?: string | null
  latitude?: number | null
  longitude?: number | null
  reporterName?: string | null
  reporterPhone?: string | null
  reporterCnic?: string | null
  legalNotes?: string | null
}

/**
 * Updates rescue report details without modifying lifecycle status or timeline milestones.
 */
export async function updateRescueReport(
  db: SanctuaryDb,
  reportId: string,
  input: UpdateRescueReportInput,
): Promise<void> {
  await ensureReportColumns(db)
  const cols = await getExistingColumns(db, 'rescue_reports')
  const now = new Date().toISOString()

  const setClauses: string[] = [
    'category = COALESCE(?, category)',
    'species = COALESCE(?, species)',
    'chief_complaint = COALESCE(?, chief_complaint)',
    'location_area = COALESCE(?, location_area)',
    'location_landmark = ?',
    'reporter_name = ?',
    'reporter_phone = ?',
  ]
  const params: any[] = [
    input.category ?? null,
    input.species ?? null,
    input.chiefComplaint ?? null,
    input.locationArea ?? null,
    input.locationLandmark ?? null,
    input.reporterName ?? null,
    input.reporterPhone ?? null,
  ]

  if (cols.size === 0 || cols.has('life_stage')) {
    setClauses.push('life_stage = COALESCE(?, life_stage)')
    params.push(input.lifeStage ?? null)
  }

  if (cols.size === 0 || cols.has('city')) {
    setClauses.push('city = COALESCE(?, city)')
    params.push(input.city ?? null)
  }

  if (cols.size === 0 || cols.has('latitude')) {
    setClauses.push('latitude = ?')
    params.push(input.latitude ?? null)
  }

  if (cols.size === 0 || cols.has('longitude')) {
    setClauses.push('longitude = ?')
    params.push(input.longitude ?? null)
  }

  if (cols.size === 0 || cols.has('reporter_cnic')) {
    setClauses.push('reporter_cnic = ?')
    params.push(input.reporterCnic ?? null)
  }

  if (cols.size === 0 || cols.has('legal_notes')) {
    setClauses.push('legal_notes = COALESCE(?, legal_notes)')
    params.push(input.legalNotes ?? null)
  }

  setClauses.push('updated_at = ?')
  params.push(now)
  params.push(reportId)

  await db.execute(
    `UPDATE rescue_reports
     SET ${setClauses.join(', ')}
     WHERE id = ?`,
    params,
  )
}

/**
 * Deletes a report photo entry.
 */
export async function deleteReportPhoto(
  db: SanctuaryDb,
  photoId: string,
): Promise<void> {
  await db.execute(`DELETE FROM report_photos WHERE id = ?`, [photoId])
}

export { formatPhoneNumber, validatePhoneNumber } from './phone'
export { formatCnic, validateCnic } from './cnic'
export {
  parseCoordinates,
  isValidLatLng,
  formatCoordinates,
  getNavigationUrl,
  requestCurrentPosition,
  type Coordinates,
} from './coordinates'
export * from './pakistanLocations'

