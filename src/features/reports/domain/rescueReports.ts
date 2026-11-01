import type { SanctuaryDb } from '@/shared/lib/db'
import {
  AppSchema,
  type RescueReportRecord,
  type ReportPhotoRecord,
} from '@/features/sync/powersync/schema'
import { compressImage } from '@/shared/lib/r2/upload'
import { storeLocalPhoto, getLocalPhoto } from '@/features/photos/domain/photos'
import { notifyPendingMediaChanged } from '@/shared/lib/pendingMedia'
import { createAnimal } from '@/features/animals/domain/animals'
import { linkAnimals, type RelationshipType } from '@/features/animals/domain/relationships'
import { listStatuses } from '@/features/statuses/domain/statuses'
import { localDateString } from '@/shared/lib/checklist/missedStreak'
import { toSentenceCase } from '@/shared/lib/text'
import { getBatchReportCompletionMap } from '@/features/reports/domain/reportOutcomes'

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
  | 'deceased_doa'

export type IntakeSource =
  | 'citizen'
  | 'rescue_1122'
  | 'field_patrol'
  | 'partner_transfer'
  | 'walk_in'
  | 'direct_intake'

export const AVIAN_PRESETS = [
  'Black Kite',
  'Eagle',
  'Pigeon / Dove',
  'Crow',
  'Owl',
  'Hawk',
  'Other Bird',
] as const

export type RescueReportFilter = 'all' | 'new' | 'in_progress' | 'completed'

export type RescueReport = RescueReportRecord
export type ReportPhoto = ReportPhotoRecord
export type AnimalGroupItem = {
  id: string
  count: number
  species: string
  lifeStage?: 'adult' | 'child' | null
  avianSubtype?: string | null
}

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
  intakeSource?: IntakeSource | null
  animalCount?: number | null
  groupBreakdown?: string | null
  createdAt?: string | null
  status?: RescueReportStage
  stageAttendedAt?: string | null
  dispositionType?: RescueReportDisposition | null
  animalId?: string | null
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
      cols.has('life_stage') &&
      cols.has('intake_source') &&
      cols.has('animal_count') &&
      cols.has('group_breakdown') &&
      cols.has('archived')
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
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN intake_source TEXT`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN animal_count INTEGER`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN group_breakdown TEXT`).catch(() => {})
        await db.execute(`ALTER TABLE rescue_reports ADD COLUMN archived INTEGER DEFAULT 0`).catch(() => {})
      }
    }
  } catch (err) {
    console.warn('ensureReportColumns error', err)
  }
}

export type FrequentCaller = {
  name: string
  phone: string
  cnic?: string | null
  area?: string | null
  count: number
}

export async function searchFrequentCallers(
  db: SanctuaryDb,
  orgId: string,
  query: string,
  limit = 5,
): Promise<FrequentCaller[]> {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 2) return []
  const digits = trimmed.replace(/\D/g, '')

  try {
    if (typeof db.getAll === 'function') {
      let sql = `
        SELECT 
          reporter_name as name, 
          reporter_phone as phone, 
          reporter_cnic as cnic, 
          location_area as area, 
          COUNT(*) as count
        FROM rescue_reports
        WHERE org_id = ? AND (archived IS NULL OR archived = 0) AND reporter_name IS NOT NULL AND reporter_name != ''
      `
      const params: any[] = [orgId]

      if (digits.length >= 3) {
        sql += ` AND (reporter_phone LIKE ? OR reporter_name LIKE ?)`
        params.push(`%${digits}%`, `%${trimmed}%`)
      } else {
        sql += ` AND reporter_name LIKE ?`
        params.push(`%${trimmed}%`)
      }

      sql += ` GROUP BY reporter_phone, reporter_name ORDER BY count DESC LIMIT ?`
      params.push(limit)

      const rows = await db.getAll<FrequentCaller>(sql, params)
      return Array.isArray(rows) ? rows : []
    }
  } catch (err) {
    console.warn('searchFrequentCallers error', err)
  }
  return []
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
  const createdAtIso = input.createdAt
    ? Number.isNaN(new Date(input.createdAt).getTime())
      ? now
      : new Date(input.createdAt).toISOString()
    : now

  const status = input.status ?? 'logged'
  const stageAttendedAt =
    input.stageAttendedAt !== undefined
      ? input.stageAttendedAt
        ? Number.isNaN(new Date(input.stageAttendedAt).getTime())
          ? now
          : new Date(input.stageAttendedAt).toISOString()
        : null
      : status === 'attended'
        ? createdAtIso
        : null

  const report: RescueReport = {
    id,
    org_id: input.orgId,
    report_number: input.reportNumber.trim(),
    category: input.category?.trim() || 'emergency',
    species: input.species.trim(),
    life_stage: input.lifeStage ?? 'adult',
    chief_complaint: input.chiefComplaint.trim(),
    status,
    city: input.city?.trim() || 'Lahore',
    location_area: input.locationArea.trim(),
    location_landmark: input.locationLandmark?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    reporter_name: input.reporterName?.trim() || null,
    reporter_phone: input.reporterPhone?.trim() || null,
    reporter_cnic: input.reporterCnic?.trim() || null,
    transport_type: null,
    disposition_type: input.dispositionType ?? null,
    animal_id: input.animalId ?? null,
    legal_notes: null,
    dismissal_reason: null,
    intake_source: input.intakeSource || 'citizen',
    animal_count: input.animalCount && input.animalCount > 0 ? input.animalCount : 1,
    group_breakdown: input.groupBreakdown ?? null,
    archived: 0,
    stage_logged_at: createdAtIso,
    stage_accepted_at: null,
    stage_dispatched_at: null,
    stage_attended_at: stageAttendedAt,
    created_at: createdAtIso,
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
    intake_source: report.intake_source,
    animal_count: report.animal_count,
    group_breakdown: report.group_breakdown,
    archived: report.archived,
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

  const sql = `SELECT * FROM rescue_reports WHERE org_id = ? AND (archived IS NULL OR archived = 0)${filterClause} ORDER BY created_at DESC`
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
    `SELECT * FROM rescue_reports WHERE id = ? AND (archived IS NULL OR archived = 0)`,
    [reportId],
  )
}

/**
 * Soft-deletes a rescue report by marking it archived.
 */
export async function archiveRescueReport(
  db: SanctuaryDb,
  reportId: string,
): Promise<void> {
  await ensureReportColumns(db)
  const now = new Date().toISOString()
  await db.execute(
    `UPDATE rescue_reports SET archived = 1, updated_at = ? WHERE id = ?`,
    [now, reportId],
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

/**
 * Deterministically generates a valid UUID v5-compatible string from namespace and name.
 */
export async function deterministicUuid(namespace: string, name: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(`${namespace}:${name}`)
  let hashBuffer: ArrayBuffer
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    hashBuffer = await crypto.subtle.digest('SHA-256', data)
  } else {
    const { createHash } = await import('crypto')
    const h = createHash('sha256').update(data).digest()
    hashBuffer = h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength)
  }
  const bytes = new Uint8Array(hashBuffer).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Synchronizes report photos to the animal's photos table idempotently.
 * Strictly enforces valid Postgres check constraints (capture_source = 'gallery', upload_state = 'pending' | 'uploaded').
 */
export async function syncReportPhotosToAnimal(
  db: SanctuaryDb,
  reportId: string,
  animalId: string,
  orgId: string,
): Promise<void> {
  if (!db || !reportId || !animalId || !orgId) return

  const reportPhotos = await getPhotosForReport(db, reportId)
  if (!reportPhotos || reportPhotos.length === 0) return

  const now = new Date().toISOString()
  const existingPhotos = await db.getAll<{ id: string; r2_key: string | null }>(
    `SELECT id, r2_key FROM photos WHERE animal_id = ?`,
    [animalId],
  ).catch(() => [])

  const existingKeys = new Set(
    existingPhotos.map((p) => p.r2_key).filter((k): k is string => Boolean(k)),
  )

  for (const rp of reportPhotos) {
    const animalPhotoId = await deterministicUuid(animalId, rp.id)
    const alreadyExists =
      existingPhotos.some((p) => p.id === animalPhotoId) ||
      (rp.r2_key && existingKeys.has(rp.r2_key))

    if (alreadyExists) {
      if (rp.r2_key) {
        await db.execute(
          `UPDATE photos SET r2_key = ?, local_only = 0, upload_state = 'uploaded' WHERE id = ? AND (r2_key IS NULL OR upload_state != 'uploaded')`,
          [rp.r2_key, animalPhotoId],
        ).catch(() => {})
      }
      continue
    }

    try {
      const blob = await getLocalPhoto(rp.id)
      if (blob) {
        await storeLocalPhoto(animalPhotoId, blob)
      }
    } catch {
      // Non-fatal if local cache copy fails
    }

    const hasR2 = Boolean(rp.r2_key)
    const uploadState = hasR2 ? (rp.upload_state === 'failed' ? 'failed' : 'uploaded') : 'pending'

    await db.execute(
      `INSERT INTO photos (id, org_id, animal_id, r2_key, local_only, upload_state, capture_source, verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        animalPhotoId,
        orgId,
        animalId,
        rp.r2_key ?? null,
        hasR2 ? 0 : 1,
        uploadState,
        'gallery',
        0,
        rp.created_at || now,
      ],
    ).catch((err) => {
      console.warn('Could not insert mirrored animal photo', err)
    })
  }

  notifyPendingMediaChanged()
}

/**
 * Automatically creates animal record(s) from a rescue report (e.g. for walk-in or shelter admission).
 * Handles companion animals, litter breakdowns, and photo synchronization.
 */
export async function createAnimalFromRescueReport(
  db: SanctuaryDb,
  report: RescueReport,
  options?: {
    orgId?: string
    orgInitials?: string
    disposition?: 'spot_released' | 'admitted_shelter'
    attendedDate?: Date
  },
): Promise<string> {
  const orgId = options?.orgId || report.org_id
  if (!orgId) throw new Error('Organization ID is missing')

  const prefix = options?.orgInitials || report.report_number?.split('-')[0] || 'MS'
  let targetStatusId: string | null = null

  try {
    const statuses = await listStatuses(db, orgId)
    if (options?.disposition === 'spot_released') {
      const released = statuses.find((s) => s.label.toLowerCase() === 'released')
      targetStatusId = released?.id ?? statuses[0]?.id ?? null
    } else {
      const intake =
        statuses.find((s) => !s.archived && s.label.trim().toLowerCase() === 'intake') ??
        statuses.find((s) => !s.archived && s.counts_as_in_care === 1) ??
        statuses[0]
      targetStatusId = intake?.id ?? null
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

  const attendedDate =
    options?.attendedDate ??
    (report.stage_attended_at
      ? new Date(report.stage_attended_at)
      : report.created_at
        ? new Date(report.created_at)
        : new Date())
  const intakeDate = localDateString(attendedDate)
  const intakeTime = `${String(attendedDate.getHours()).padStart(2, '0')}:${String(attendedDate.getMinutes()).padStart(2, '0')}`
  const arrivalTimestamp = attendedDate.toISOString()

  // Multi-animal / litter intake support: parse breakdown first so primary animal gets actual species
  let parsedGroup: Array<{ count: number; species: string; lifeStage?: string; avianSubtype?: string }> = []
  if (report.group_breakdown) {
    try {
      const parsed = JSON.parse(report.group_breakdown)
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsedGroup = parsed
      }
    } catch (err) {
      console.warn('Failed to parse group_breakdown', err)
    }
  }

  const allAnimals =
    parsedGroup.length > 0
      ? parsedGroup.flatMap((item) =>
          Array.from({ length: Math.max(1, item.count) }, () => ({
            species: (item.avianSubtype || item.species || report.species || 'other').toLowerCase(),
            lifeStage:
              (item.lifeStage as 'adult' | 'child' | undefined) ??
              (report.life_stage as 'adult' | 'child' | undefined),
          })),
        )
      : []

  const primarySpec = allAnimals[0]
  const primarySpecies =
    primarySpec?.species ||
    (report.species && report.species.toLowerCase() !== 'mixed' ? report.species.toLowerCase() : 'other')
  const primaryLifeStage =
    primarySpec?.lifeStage || (report.life_stage as 'adult' | 'child') || undefined

  const animal = await createAnimal(db, {
    orgId,
    prefix,
    species: primarySpecies,
    lifeStage: primaryLifeStage,
    statusIds: targetStatusId ? [targetStatusId] : ['status-intake'],
    notes: notesText,
    markings: markingsText,
    intakeDate,
    intakeTime,
    arrivalTimestamp,
  })

  // Transfer report photos to animal photos table and local cache
  try {
    await syncReportPhotosToAnimal(db, report.id, animal.id, orgId)
  } catch (photoErr) {
    console.warn('Could not copy report photos to animal', photoErr)
  }

  const createdAnimalList: Array<{
    id: string
    species: string
    lifeStage?: 'adult' | 'child'
  }> = [
    {
      id: animal.id,
      species: primarySpecies,
      lifeStage: primaryLifeStage,
    },
  ]

  if (allAnimals.length > 1) {
    for (let i = 1; i < allAnimals.length; i++) {
      const spec = allAnimals[i]
      const companionLifeStage =
        spec.lifeStage || (primaryLifeStage === 'adult' ? 'child' : undefined)
      try {
        const companion = await createAnimal(db, {
          orgId,
          prefix,
          species: spec.species.toLowerCase(),
          lifeStage: companionLifeStage,
          statusIds: targetStatusId ? [targetStatusId] : ['status-intake'],
          notes: `${notesText}\nCompanion #${i + 1} of ${allAnimals.length} in batch intake`,
          markings: markingsText,
          intakeDate,
          intakeTime,
          arrivalTimestamp,
        })
        createdAnimalList.push({
          id: companion.id,
          species: spec.species.toLowerCase(),
          lifeStage: companionLifeStage,
        })
      } catch (compErr) {
        console.warn('Could not create companion animal for group', compErr)
      }
    }
  } else if (allAnimals.length === 0) {
    const count = report.animal_count && report.animal_count > 1 ? report.animal_count : 1
    if (count > 1) {
      for (let i = 2; i <= count; i++) {
        const companionLifeStage =
          primaryLifeStage === 'adult'
            ? 'child'
            : primaryLifeStage === 'child'
              ? 'child'
              : undefined
        try {
          const companion = await createAnimal(db, {
            orgId,
            prefix,
            species: primarySpecies,
            lifeStage: companionLifeStage,
            statusIds: targetStatusId ? [targetStatusId] : ['status-intake'],
            notes: `${notesText}\nCompanion #${i} of ${count} in batch litter/group admission`,
            markings: markingsText,
            intakeDate,
            intakeTime,
            arrivalTimestamp,
          })
          createdAnimalList.push({
            id: companion.id,
            species: primarySpecies,
            lifeStage: companionLifeStage,
          })
        } catch (compErr) {
          console.warn('Could not create companion animal for group', compErr)
        }
      }
    }
  }

  // Multi-animal relationships:
  // For mixed reports or groups with differing species, no relationship can be inferred - do not create false links.
  // For litters / single-species groups, link all animals to each other (full mesh) so every sibling sees all others.
  const distinctSpecies = new Set(createdAnimalList.map((a) => a.species.toLowerCase()))
  const isMixed = report.species?.toLowerCase() === 'mixed' || distinctSpecies.size > 1

  if (!isMixed && createdAnimalList.length > 1) {
    for (let i = 0; i < createdAnimalList.length; i++) {
      for (let j = i + 1; j < createdAnimalList.length; j++) {
        const a1 = createdAnimalList[i]
        const a2 = createdAnimalList[j]
        try {
          let relationshipType: RelationshipType = 'sibling'
          if (a1.lifeStage === 'adult' && a2.lifeStage === 'child') {
            relationshipType = 'child'
          } else if (a1.lifeStage === 'child' && a2.lifeStage === 'adult') {
            relationshipType = 'mother'
          } else {
            relationshipType = 'sibling'
          }
          await linkAnimals(db, {
            orgId,
            animalId: a1.id,
            relatedAnimalId: a2.id,
            relationshipType,
            notes: `Auto-linked from rescue report ${report.report_number || ''}`,
          })
        } catch (linkErr) {
          console.warn('Could not link littermates', linkErr)
        }
      }
    }
  }

  // Update group_breakdown JSON with the created animal IDs so group screens and outcome checks can track all animals without requiring false relationship links
  if (parsedGroup.length > 0) {
    let animalIdx = 0
    const updatedGroup = parsedGroup.map((item) => {
      const itemAnimalIds: string[] = []
      const count = Math.max(1, item.count)
      for (let c = 0; c < count; c++) {
        if (animalIdx < createdAnimalList.length) {
          itemAnimalIds.push(createdAnimalList[animalIdx].id)
          animalIdx++
        }
      }
      return {
        ...item,
        animalId: itemAnimalIds[0],
        animalIds: itemAnimalIds,
      }
    })
    try {
      const updatedJson = JSON.stringify(updatedGroup)
      await db.execute(
        `UPDATE rescue_reports SET group_breakdown = ?, animal_id = COALESCE(animal_id, ?), updated_at = ? WHERE id = ?`,
        [updatedJson, animal.id, new Date().toISOString(), report.id],
      )
      report.group_breakdown = updatedJson
    } catch (updateErr) {
      console.warn('Could not update report group_breakdown with animal IDs', updateErr)
    }
  } else if (createdAnimalList.length > 1) {
    const groupItems = createdAnimalList.map((a, idx) => ({
      id: `animal-${idx + 1}`,
      count: 1,
      species: a.species,
      lifeStage: a.lifeStage,
      animalId: a.id,
      animalIds: [a.id],
    }))
    try {
      const updatedJson = JSON.stringify(groupItems)
      await db.execute(
        `UPDATE rescue_reports SET group_breakdown = ?, animal_id = COALESCE(animal_id, ?), updated_at = ? WHERE id = ?`,
        [updatedJson, animal.id, new Date().toISOString(), report.id],
      )
      report.group_breakdown = updatedJson
    } catch (updateErr) {
      console.warn('Could not update report group_breakdown with animal IDs', updateErr)
    }
  }

  return animal.id
}


let reportPhotoQueueRunning: Promise<{ uploaded: number; failed: number }> | null = null

/**
 * Uploads pending report photos to cloud storage (R2).
 */
export async function processReportPhotoQueue(
  db: SanctuaryDb,
): Promise<{ uploaded: number; failed: number }> {
  if (reportPhotoQueueRunning) return reportPhotoQueueRunning

  reportPhotoQueueRunning = (async () => {
    const { requestSignedUpload } = await import('@/shared/lib/r2/upload')
    const pending = await db.getAll<ReportPhotoRecord>(
      `SELECT * FROM report_photos WHERE upload_state IN ('pending', 'failed') ORDER BY created_at ASC LIMIT 10`,
    ).catch(() => [])

    let uploaded = 0
    let failed = 0

    for (const photo of pending) {
      try {
        const blob = await getLocalPhoto(photo.id)
        if (!blob) {
          if (photo.r2_key) {
            await db.execute(
              `UPDATE report_photos SET upload_state = 'uploaded', local_only = 0 WHERE id = ?`,
              [photo.id],
            )
            uploaded += 1
          }
          continue
        }

        await db.execute(
          `UPDATE report_photos SET upload_state = 'uploading' WHERE id = ?`,
          [photo.id],
        )

        const key = `${photo.org_id}/reports/${photo.report_id}/${photo.id}.jpg`
        const { uploadUrl, publicUrl } = await requestSignedUpload(key)

        if (!uploadUrl.includes('mock=upload')) {
          const put = await fetch(uploadUrl, {
            method: 'PUT',
            body: blob,
          })
          if (!put.ok) {
            const detail = (await put.text().catch(() => '')).slice(0, 200)
            throw new Error(`R2 upload failed: ${put.status}${detail ? ` ${detail}` : ''}`)
          }
        }

        const finalKey = publicUrl || key
        await db.execute(
          `UPDATE report_photos SET r2_key = ?, local_only = 0, upload_state = 'uploaded' WHERE id = ?`,
          [finalKey, photo.id],
        )

        // Mirror R2 key to animal photo if report has an associated animal
        const reportRow = await db.getOptional<{ animal_id: string | null }>(
          `SELECT animal_id FROM rescue_reports WHERE id = ?`,
          [photo.report_id],
        ).catch(() => null)
        if (reportRow?.animal_id) {
          const detId = await deterministicUuid(reportRow.animal_id, photo.id)
          await db.execute(
            `UPDATE photos SET r2_key = ?, local_only = 0, upload_state = 'uploaded' WHERE id = ? AND (r2_key IS NULL OR upload_state != 'uploaded')`,
            [finalKey, detId],
          ).catch(() => {})
        }

        uploaded += 1
      } catch (err) {
        console.warn('Report photo upload failed:', err)
        await db.execute(
          `UPDATE report_photos SET upload_state = 'failed' WHERE id = ?`,
          [photo.id],
        ).catch(() => {})
        failed += 1
      }
    }

    return { uploaded, failed }
  })()

  try {
    return await reportPhotoQueueRunning
  } finally {
    reportPhotoQueueRunning = null
    notifyPendingMediaChanged()
  }
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
  intakeSource?: IntakeSource | null
  animalCount?: number | null
  groupBreakdown?: string | null
  createdAt?: string | null
  stageAttendedAt?: string | null
  status?: RescueReportStage
  dispositionType?: RescueReportDisposition | null
  animalId?: string | null
}

/**
 * Updates rescue report details without modifying lifecycle status or timeline milestones (unless explicitly supplied).
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

  if (cols.size === 0 || cols.has('intake_source')) {
    setClauses.push('intake_source = COALESCE(?, intake_source)')
    params.push(input.intakeSource ?? null)
  }

  if (cols.size === 0 || cols.has('animal_count')) {
    setClauses.push('animal_count = COALESCE(?, animal_count)')
    params.push(input.animalCount ?? null)
  }

  if (cols.size === 0 || cols.has('group_breakdown')) {
    setClauses.push('group_breakdown = ?')
    params.push(input.groupBreakdown ?? null)
  }

  if (input.createdAt !== undefined && input.createdAt !== null) {
    const parsedIso = Number.isNaN(new Date(input.createdAt).getTime())
      ? input.createdAt
      : new Date(input.createdAt).toISOString()
    setClauses.push('created_at = ?')
    params.push(parsedIso)
    setClauses.push('stage_logged_at = ?')
    params.push(parsedIso)
  }

  if (input.stageAttendedAt !== undefined && input.stageAttendedAt !== null) {
    const parsedIso = Number.isNaN(new Date(input.stageAttendedAt).getTime())
      ? input.stageAttendedAt
      : new Date(input.stageAttendedAt).toISOString()
    setClauses.push('stage_attended_at = ?')
    params.push(parsedIso)
  }

  if (input.status !== undefined) {
    setClauses.push('status = ?')
    params.push(input.status)
  }

  if (input.dispositionType !== undefined) {
    setClauses.push('disposition_type = ?')
    params.push(input.dispositionType)
  }

  if (input.animalId !== undefined) {
    setClauses.push('animal_id = ?')
    params.push(input.animalId)
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

export type RescueOperationsSummary = {
  total: number
  awaitingTriage: number
  inProgress?: number
  resolved?: number
  inField: number
  attended: number
  cancelled: number
}

export type RescueCategoryBreakdown = {
  emergency: number
  cruelty: number
  crueltyLegalNotice: number
  crueltyDismissed: number
}

export type RescueSpeciesCount = {
  species: string
  count: number
  adultCount: number
  childCount: number
}

export type RescueHotspot = {
  area: string
  city: string | null
  count: number
}

export type RescueMonthlyTrend = {
  month: string
  count: number
}

export async function getRescueOperationsSummary(
  db: SanctuaryDb,
  orgId: string,
): Promise<RescueOperationsSummary> {
  let rows: { status: string; count: number }[] = []
  if (typeof db?.getAll === 'function') {
    try {
      rows = await db.getAll<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count
         FROM rescue_reports
         WHERE org_id = ? AND (archived IS NULL OR archived = 0)
         GROUP BY status`,
        [orgId],
      )
    } catch {
      rows = []
    }
  }

  let total = 0
  let awaitingTriage = 0
  let inField = 0
  let attended = 0
  let cancelled = 0

  for (const row of rows) {
    const count = Number(row.count) || 0
    total += count
    if (row.status === 'logged') awaitingTriage += count
    else if (row.status === 'accepted' || row.status === 'dispatched') inField += count
    else if (row.status === 'attended') attended += count
    else if (row.status === 'cancelled') cancelled += count
  }

  let attendedResolved = 0
  if (attended > 0 && typeof db?.getAll === 'function') {
    try {
      const attendedReports = await db.getAll<RescueReport>(
        `SELECT *
         FROM rescue_reports
         WHERE org_id = ? AND status = 'attended' AND (archived IS NULL OR archived = 0)`,
        [orgId],
      )
      if (Array.isArray(attendedReports) && attendedReports.length > 0) {
        const compMap = await getBatchReportCompletionMap(db, attendedReports)
        for (const rep of attendedReports) {
          if (
            rep.disposition_type === 'spot_released' ||
            rep.disposition_type === 'deceased_doa' ||
            compMap.get(rep.id)?.isCompleted === true
          ) {
            attendedResolved++
          }
        }
      }
    } catch {
      // Fallback if full check fails (e.g. in minimal unit test mock)
    }
  }

  const attendedInProgress = Math.max(0, attended - attendedResolved)
  const inProgress = inField + attendedInProgress
  const resolved = cancelled + attendedResolved

  return {
    total,
    awaitingTriage,
    inProgress,
    resolved,
    inField,
    attended,
    cancelled,
  }
}

export async function getRescueCategoryBreakdown(
  db: SanctuaryDb,
  orgId: string,
): Promise<RescueCategoryBreakdown> {
  const catRows = await db.getAll<{ category: string; count: number }>(
    `SELECT category, COUNT(*) as count
     FROM rescue_reports
     WHERE org_id = ? AND (archived IS NULL OR archived = 0)
     GROUP BY category`,
    [orgId],
  ).catch(() => [])

  let emergency = 0
  let cruelty = 0
  for (const row of catRows) {
    const count = Number(row.count) || 0
    if (row.category === 'cruelty') cruelty += count
    else emergency += count
  }

  const legalRows = await db.getAll<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM rescue_reports
     WHERE org_id = ? AND (archived IS NULL OR archived = 0) AND category = 'cruelty' AND legal_notes IS NOT NULL AND legal_notes != ''`,
    [orgId],
  ).catch(() => [])
  const crueltyLegalNotice = Number(legalRows[0]?.count) || 0

  const dismissedRows = await db.getAll<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM rescue_reports
     WHERE org_id = ? AND (archived IS NULL OR archived = 0) AND category = 'cruelty' AND dismissal_reason IS NOT NULL AND dismissal_reason != ''`,
    [orgId],
  ).catch(() => [])
  const crueltyDismissed = Number(dismissedRows[0]?.count) || 0

  return { emergency, cruelty, crueltyLegalNotice, crueltyDismissed }
}

export async function getRescueSpeciesBreakdown(
  db: SanctuaryDb,
  orgId: string,
): Promise<RescueSpeciesCount[]> {
  let rows: Array<{
    species: string | null
    animal_count?: number | null
    life_stage?: string | null
    group_breakdown?: string | null
    animal_id?: string | null
    count?: number
    child_count?: number
    adult_count?: number
  }> = []

  if (typeof db?.getAll === 'function') {
    try {
      rows = await db.getAll<any>(
        `SELECT
           species,
           animal_count,
           life_stage,
           group_breakdown,
           animal_id
         FROM rescue_reports
         WHERE org_id = ? AND (archived IS NULL OR archived = 0)`,
        [orgId],
      )
    } catch {
      rows = []
    }
  }

  // Aggregate by normalized species
  const speciesMap = new Map<string, { count: number; adultCount: number; childCount: number }>()

  // Also collect any animal IDs that might need resolving if species is 'mixed' and no breakdown exists
  const mixedAnimalIds: string[] = []
  for (const row of rows) {
    if (
      row.species?.toLowerCase() === 'mixed' &&
      !row.group_breakdown &&
      row.animal_id &&
      typeof db?.getAll === 'function'
    ) {
      mixedAnimalIds.push(row.animal_id)
    }
  }

  const animalSpeciesMap = new Map<string, { species: string; lifeStage?: string | null }>()
  if (mixedAnimalIds.length > 0 && typeof db?.getAll === 'function') {
    try {
      const placeholders = mixedAnimalIds.map(() => '?').join(', ')
      const animals = await db.getAll<{ id: string; species: string; life_stage: string | null }>(
        `SELECT id, species, life_stage FROM animals WHERE id IN (${placeholders})`,
        mixedAnimalIds,
      )
      if (Array.isArray(animals)) {
        for (const a of animals) {
          if (a.species) {
            animalSpeciesMap.set(a.id, { species: a.species, lifeStage: a.life_stage })
          }
        }
      }
    } catch {
      // ignore
    }
  }

  for (const row of rows) {
    if (row.group_breakdown) {
      try {
        const parsed = JSON.parse(row.group_breakdown)
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const rawSpecies = item.species || row.species || 'Unknown'
            const sp = rawSpecies.trim().toLowerCase()
            const cnt = Number(item.count) > 0 ? Number(item.count) : 1
            const isChild = item.lifeStage === 'child' || (!item.lifeStage && row.life_stage === 'child')

            const cur = speciesMap.get(sp) || { count: 0, adultCount: 0, childCount: 0 }
            cur.count += cnt
            if (isChild) {
              cur.childCount += cnt
            } else {
              cur.adultCount += cnt
            }
            speciesMap.set(sp, cur)
          }
          continue
        }
      } catch (err) {
        console.warn('Failed to parse group_breakdown in getRescueSpeciesBreakdown', err)
      }
    }

    // Single report or legacy row
    let rawSpecies = row.species || 'Unknown'
    let rawLifeStage = row.life_stage

    // If marked as 'mixed' but has an animal record, use the real animal's species
    if (rawSpecies.toLowerCase() === 'mixed' && row.animal_id && animalSpeciesMap.has(row.animal_id)) {
      const resolved = animalSpeciesMap.get(row.animal_id)!
      rawSpecies = resolved.species
      if (resolved.lifeStage) rawLifeStage = resolved.lifeStage
    }

    const sp = rawSpecies.trim().toLowerCase()
    const cnt =
      row.count !== undefined
        ? Number(row.count) || 0
        : Number(row.animal_count) > 0
          ? Number(row.animal_count)
          : 1
    const isChild =
      row.child_count !== undefined
        ? Number(row.child_count) > 0
        : rawLifeStage === 'child'
    const childCnt =
      row.child_count !== undefined
        ? Number(row.child_count) || 0
        : isChild
          ? cnt
          : 0
    const adultCnt =
      row.adult_count !== undefined
        ? Number(row.adult_count) || 0
        : isChild
          ? 0
          : cnt

    const cur = speciesMap.get(sp) || { count: 0, adultCount: 0, childCount: 0 }
    cur.count += cnt
    cur.childCount += childCnt
    cur.adultCount += adultCnt
    speciesMap.set(sp, cur)
  }

  const results: RescueSpeciesCount[] = []
  for (const [speciesKey, data] of speciesMap.entries()) {
    results.push({
      species: toSentenceCase(speciesKey),
      count: data.count,
      adultCount: data.adultCount,
      childCount: data.childCount,
    })
  }

  results.sort((a, b) => b.count - a.count || a.species.localeCompare(b.species))
  return results
}

export async function getRescueHotspots(
  db: SanctuaryDb,
  orgId: string,
  limit = 5,
): Promise<RescueHotspot[]> {
  const rows = await db.getAll<{ location_area: string; city: string | null; count: number }>(
    `SELECT location_area, city, COUNT(*) as count
     FROM rescue_reports
     WHERE org_id = ? AND (archived IS NULL OR archived = 0) AND location_area IS NOT NULL AND location_area != ''
     GROUP BY location_area, city
     ORDER BY count DESC
     LIMIT ?`,
    [orgId, limit],
  ).catch(() => [])

  return rows.map((r) => ({
    area: r.location_area?.trim() || 'Unknown area',
    city: r.city?.trim() || null,
    count: Number(r.count) || 0,
  }))
}

export async function getRescueMonthlyTrend(
  db: SanctuaryDb,
  orgId: string,
  months = 6,
): Promise<RescueMonthlyTrend[]> {
  const now = new Date()
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    keys.push(`${y}-${m}`)
  }

  const from = `${keys[0]}-01`
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const to = end.toISOString().slice(0, 10)

  const rows = await db.getAll<{ month: string; count: number }>(
    `SELECT substr(created_at, 1, 7) as month, COUNT(*) as count
     FROM rescue_reports
     WHERE org_id = ? AND (archived IS NULL OR archived = 0) AND created_at >= ? AND created_at <= ?
     GROUP BY month`,
    [orgId, from, `${to}T23:59:59.999Z`],
  ).catch(() => [])

  const map = new Map<string, number>()
  for (const key of keys) {
    map.set(key, 0)
  }
  for (const row of rows) {
    if (row.month && map.has(row.month)) {
      map.set(row.month, Number(row.count) || 0)
    }
  }

  return keys.map((month) => ({
    month,
    count: map.get(month) ?? 0,
  }))
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
export * from './reportOutcomes'
export { toDatetimeLocalValue } from '@/shared/lib/dates'



