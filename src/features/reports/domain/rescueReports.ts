import type { SanctuaryDb } from '@/shared/lib/db'
import {
  AppSchema,
  type RescueReportRecord,
  type ReportPhotoRecord,
} from '@/features/sync/powersync/schema'
import { compressImage } from '@/shared/lib/r2/upload'
import { storeLocalPhoto, getLocalPhoto } from '@/features/photos/domain/photos'
import { notifyPendingMediaChanged } from '@/shared/lib/pendingMedia'

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

export type IntakeSource = 'citizen' | 'rescue_1122' | 'field_patrol' | 'partner_transfer'

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
    intake_source: input.intakeSource || 'citizen',
    animal_count: input.animalCount && input.animalCount > 0 ? input.animalCount : 1,
    group_breakdown: input.groupBreakdown ?? null,
    archived: 0,
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

  return { total, awaitingTriage, inField, attended, cancelled }
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
  const existingCols = await getExistingColumns(db, 'rescue_reports').catch(() => new Set<string>())
  const hasCount = existingCols.has('animal_count')
  const countExpr = hasCount ? 'COALESCE(animal_count, 1)' : '1'

  const rows = await db.getAll<{
    species: string
    count: number
    child_count: number
    adult_count: number
  }>(
    `SELECT
       species,
       SUM(${countExpr}) as count,
       SUM(CASE WHEN life_stage = 'child' THEN ${countExpr} ELSE 0 END) as child_count,
       SUM(CASE WHEN life_stage != 'child' OR life_stage IS NULL THEN ${countExpr} ELSE 0 END) as adult_count
     FROM rescue_reports
     WHERE org_id = ? AND (archived IS NULL OR archived = 0)
     GROUP BY species
     ORDER BY count DESC`,
    [orgId],
  ).catch(() => [])

  return rows.map((r) => ({
    species: r.species?.trim() || 'Unknown',
    count: Number(r.count) || 0,
    adultCount: Number(r.adult_count) || 0,
    childCount: Number(r.child_count) || 0,
  }))
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


