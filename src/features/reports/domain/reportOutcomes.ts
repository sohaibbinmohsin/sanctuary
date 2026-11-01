import type { SanctuaryDb } from '@/shared/lib/db'
import type { RescueReport } from '@/features/reports/domain/rescueReports'

export type ReportCompletionResult = {
  isCompleted: boolean
  outcomeLabel: string
  activeCount: number
  completedCount: number
  completedAt?: string | null
}

interface AnimalStatusRow {
  id: string
  counts_as_in_care: number
  status_label: string | null
  status_timestamp?: string | null
  updated_at?: string | null
}

/**
 * Evaluates whether a rescue report is completed based on its disposition
 * or the in-care status of all linked animals (primary animal and companions).
 *
 * Rules:
 * - Cancelled reports are completed.
 * - Spot released or deceased DOA reports are completed.
 * - Otherwise, if any linked animal is still in care (counts_as_in_care === 1),
 *   the report is NOT completed (isCompleted: false).
 * - A report is completed when all linked animals have reached exit outcomes
 *   (counts_as_in_care === 0, such as Transferred, Released, Adopted, Deceased).
 */
export async function getReportCompletionStatus(
  db: SanctuaryDb,
  report: RescueReport,
): Promise<ReportCompletionResult> {
  if (report.status === 'cancelled') {
    return {
      isCompleted: true,
      outcomeLabel: 'Cancelled',
      activeCount: 0,
      completedCount: 0,
      completedAt: report.updated_at || report.stage_accepted_at || report.created_at,
    }
  }

  if (report.disposition_type === 'spot_released') {
    return {
      isCompleted: true,
      outcomeLabel: 'Spot Released',
      activeCount: 0,
      completedCount: 1,
      completedAt: report.stage_attended_at || report.updated_at,
    }
  }

  if (report.disposition_type === 'deceased_doa') {
    return {
      isCompleted: true,
      outcomeLabel: 'Dead on Arrival (DOA)',
      activeCount: 0,
      completedCount: 1,
      completedAt: report.stage_attended_at || report.updated_at,
    }
  }

  let primary: AnimalStatusRow | null = null
  let companions: AnimalStatusRow[] = []

  if (report.animal_id && db) {
    if (typeof db.getOptional === 'function') {
      try {
        primary = await db.getOptional<AnimalStatusRow>(
          `SELECT
             a.id,
             COALESCE(s.counts_as_in_care, 1) AS counts_as_in_care,
             s.label AS status_label,
             (
               SELECT treated_at
               FROM treatments
               WHERE animal_id = a.id AND treatment_type = 'status'
               ORDER BY treated_at DESC
               LIMIT 1
             ) AS status_timestamp,
             a.updated_at
           FROM animals a
           LEFT JOIN animal_statuses s ON s.id = a.status_id
           WHERE a.id = ?`,
          [report.animal_id],
        )
      } catch (err) {
        console.error('Failed to load primary animal for report completion check', err)
      }
    }

    if (typeof db.getAll === 'function') {
      try {
        companions =
          (await db.getAll<AnimalStatusRow>(
            `SELECT DISTINCT
               a.id,
               COALESCE(s.counts_as_in_care, 1) AS counts_as_in_care,
               s.label AS status_label,
               (
                 SELECT treated_at
                 FROM treatments
                 WHERE animal_id = a.id AND treatment_type = 'status'
                 ORDER BY treated_at DESC
                 LIMIT 1
               ) AS status_timestamp,
               a.updated_at
             FROM animal_relationships ar
             JOIN animals a ON a.id = ar.related_animal_id
             LEFT JOIN animal_statuses s ON s.id = a.status_id
             WHERE ar.animal_id = ?
               AND (ar.relationship_type != 'incompatible' OR ar.relationship_type IS NULL)`,
            [report.animal_id],
          )) || []
      } catch (err) {
        console.error('Failed to load companion animals for report completion check', err)
      }
    }
  }

  const linkedAnimals: AnimalStatusRow[] = []
  const seenIds = new Set<string>()

  if (primary && primary.id) {
    linkedAnimals.push(primary)
    seenIds.add(primary.id)
  }

  for (const comp of companions) {
    if (comp && comp.id && !seenIds.has(comp.id)) {
      linkedAnimals.push(comp)
      seenIds.add(comp.id)
    }
  }

  if (linkedAnimals.length > 0) {
    const activeAnimals = linkedAnimals.filter((a) => Number(a.counts_as_in_care) === 1)
    const completedAnimals = linkedAnimals.filter((a) => Number(a.counts_as_in_care) === 0)
    const activeCount = activeAnimals.length
    const completedCount = completedAnimals.length

    const isCompleted = activeCount === 0 && completedCount > 0

    let outcomeLabel = ''
    let completedAt: string | null = null

    if (isCompleted) {
      const uniqueExitLabels = Array.from(
        new Set(completedAnimals.map((a) => a.status_label?.trim()).filter(Boolean) as string[]),
      )
      outcomeLabel = uniqueExitLabels.length > 0 ? uniqueExitLabels.join(', ') : 'Completed'

      for (const ca of completedAnimals) {
        const ts = ca.status_timestamp || ca.updated_at
        if (ts && (!completedAt || new Date(ts).getTime() > new Date(completedAt).getTime())) {
          completedAt = ts
        }
      }
    } else {
      const uniqueActiveLabels = Array.from(
        new Set(activeAnimals.map((a) => a.status_label?.trim()).filter(Boolean) as string[]),
      )
      outcomeLabel = uniqueActiveLabels.length > 0 ? uniqueActiveLabels.join(', ') : 'In Care'
    }

    return {
      isCompleted,
      outcomeLabel,
      activeCount,
      completedCount,
      completedAt: completedAt || (isCompleted ? report.updated_at : null),
    }
  }

  if (report.disposition_type === 'transferred_partner') {
    return {
      isCompleted: true,
      outcomeLabel: 'Transferred',
      activeCount: 0,
      completedCount: 1,
      completedAt: report.stage_attended_at || report.updated_at,
    }
  }

  const defaultStatusLabels: Record<string, string> = {
    logged: 'Logged',
    accepted: 'Accepted',
    dispatched: 'Dispatched',
    attended: 'Attended',
  }

  return {
    isCompleted: false,
    outcomeLabel: (report.status && defaultStatusLabels[report.status]) || report.status || 'Logged',
    activeCount: 0,
    completedCount: 0,
  }
}

/**
 * Efficiently computes completion status for a batch of rescue reports.
 * Returns a map of reportId -> ReportCompletionResult.
 */
export async function getBatchReportCompletionMap(
  db: SanctuaryDb,
  reports: RescueReport[],
): Promise<Map<string, ReportCompletionResult>> {
  const map = new Map<string, ReportCompletionResult>()
  if (!reports || reports.length === 0) return map

  const defaultStatusLabels: Record<string, string> = {
    logged: 'Logged',
    accepted: 'Accepted',
    dispatched: 'Dispatched',
    attended: 'Attended',
  }

  const unresolvedReports: RescueReport[] = []
  for (const report of reports) {
    if (report.status === 'cancelled') {
      map.set(report.id, {
        isCompleted: true,
        outcomeLabel: 'Cancelled',
        activeCount: 0,
        completedCount: 0,
      })
    } else if (report.disposition_type === 'spot_released') {
      map.set(report.id, {
        isCompleted: true,
        outcomeLabel: 'Spot Released',
        activeCount: 0,
        completedCount: 1,
      })
    } else if (report.disposition_type === 'deceased_doa') {
      map.set(report.id, {
        isCompleted: true,
        outcomeLabel: 'Dead on Arrival (DOA)',
        activeCount: 0,
        completedCount: 1,
      })
    } else if (!report.animal_id) {
      if (report.disposition_type === 'transferred_partner') {
        map.set(report.id, {
          isCompleted: true,
          outcomeLabel: 'Transferred',
          activeCount: 0,
          completedCount: 1,
        })
      } else {
        map.set(report.id, {
          isCompleted: false,
          outcomeLabel: (report.status && defaultStatusLabels[report.status]) || report.status || 'Logged',
          activeCount: 0,
          completedCount: 0,
        })
      }
    } else {
      unresolvedReports.push(report)
    }
  }

  if (unresolvedReports.length === 0) {
    return map
  }

  const resolved = await Promise.all(
    unresolvedReports.map(async (r) => {
      try {
        const res = await getReportCompletionStatus(db, r)
        return [r.id, res] as const
      } catch (err) {
        console.error('Failed to compute completion status for report', r.id, err)
        return [
          r.id,
          {
            isCompleted: false,
            outcomeLabel: r.status || 'Logged',
            activeCount: 0,
            completedCount: 0,
          },
        ] as const
      }
    }),
  )

  for (const [id, res] of resolved) {
    map.set(id, res)
  }

  return map
}
