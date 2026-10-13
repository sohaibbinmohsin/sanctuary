import { describe, it, expect } from 'vitest'
import {
  createRescueReport,
  updateReportStage,
  completeReportWithDisposition,
  generateReportNumber,
  getRescueReports,
  getRescueReportById,
  type CreateRescueReportInput,
} from '@/features/reports/domain/rescueReports'

describe('rescueReports domain', () => {
  describe('generateReportNumber', () => {
    it('generates sequential report numbers with prefix', async () => {
      const mockDb = {
        getOptional: async () => ({ count: 5 }),
      } as any
      const code = await generateReportNumber(mockDb, 'PARC')
      expect(code).toBe('PARC-R106')
    })

    it('starts at R101 when no existing reports count is 0', async () => {
      const mockDb = {
        getOptional: async () => ({ count: 0 }),
      } as any
      const code = await generateReportNumber(mockDb, 'TOSC')
      expect(code).toBe('TOSC-R101')
    })

    it('handles null result from count query gracefully', async () => {
      const mockDb = {
        getOptional: async () => null,
      } as any
      const code = await generateReportNumber(mockDb, 'KWS')
      expect(code).toBe('KWS-R101')
    })
  })

  describe('createRescueReport', () => {
    it('creates an emergency report with logged stage and confidential reporter', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        execute: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
        },
      } as any

      const input: CreateRescueReportInput = {
        orgId: 'org-1',
        reportNumber: 'PARC-R106',
        species: 'donkey',
        chiefComplaint: 'Collapsed under cart',
        locationArea: 'Burns Road',
        locationLandmark: 'Opposite Fresco',
        reporterName: 'Usman Ali',
        reporterPhone: '0300-1234567',
      }

      const report = await createRescueReport(mockDb, input)

      expect(report.id).toBeDefined()
      expect(report.org_id).toBe('org-1')
      expect(report.report_number).toBe('PARC-R106')
      expect(report.status).toBe('logged')
      expect(report.category).toBe('emergency')
      expect(report.species).toBe('donkey')
      expect(report.chief_complaint).toBe('Collapsed under cart')
      expect(report.location_area).toBe('Burns Road')
      expect(report.location_landmark).toBe('Opposite Fresco')
      expect(report.reporter_name).toBe('Usman Ali')
      expect(report.reporter_phone).toBe('0300-1234567')
      expect(report.stage_logged_at).toBeDefined()
      expect(report.created_at).toBeDefined()
      expect(report.updated_at).toBeDefined()

      expect(executedSql).toContain('INSERT INTO rescue_reports')
      expect(executedParams).toContain('org-1')
      expect(executedParams).toContain('PARC-R106')
      expect(executedParams).toContain('emergency')
      expect(executedParams).toContain('logged')
      expect(executedParams).toContain('donkey')
    })

    it('trims inputs and handles optional landmarks and phones', async () => {
      let executedParams: any[] = []
      const mockDb = {
        execute: async (_sql: string, params: any[]) => {
          executedParams = params
        },
      } as any

      const report = await createRescueReport(mockDb, {
        orgId: 'org-1',
        reportNumber: 'PARC-R101',
        species: ' cat ',
        chiefComplaint: ' Injured paw ',
        locationArea: ' DHA Phase 5 ',
      })

      expect(report.species).toBe('cat')
      expect(report.chief_complaint).toBe('Injured paw')
      expect(report.location_area).toBe('DHA Phase 5')
      expect(report.location_landmark).toBeNull()
      expect(report.reporter_name).toBeNull()
      expect(report.reporter_phone).toBeNull()
      expect(executedParams).toContain('cat')
    })
  })

  describe('updateReportStage', () => {
    it('transitions report stage cleanly to dispatched and updates stage timestamp', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        execute: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
        },
      } as any

      await updateReportStage(mockDb, 'rep-1', 'dispatched')

      expect(executedSql).toContain('UPDATE rescue_reports')
      expect(executedSql).toContain('stage_dispatched_at')
      expect(executedParams).toContain('dispatched')
      expect(executedParams).toContain('rep-1')
    })

    it('transitions report stage to accepted and updates stage_accepted_at', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        execute: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
        },
      } as any

      await updateReportStage(mockDb, 'rep-1', 'accepted')

      expect(executedSql).toContain('stage_accepted_at')
      expect(executedParams).toContain('accepted')
    })

    it('transitions report stage to cancelled without breaking', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        execute: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
        },
      } as any

      await updateReportStage(mockDb, 'rep-1', 'cancelled')

      expect(executedSql).toContain('UPDATE rescue_reports')
      expect(executedParams).toContain('cancelled')
    })
  })

  describe('completeReportWithDisposition', () => {
    it('sets spot_released disposition and marks status attended', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        execute: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
        },
      } as any

      await completeReportWithDisposition(mockDb, 'rep-1', 'spot_released')

      expect(executedSql).toContain('UPDATE rescue_reports')
      expect(executedSql).toContain('disposition_type')
      expect(executedSql).toContain('stage_attended_at')
      expect(executedParams).toContain('attended')
      expect(executedParams).toContain('spot_released')
      expect(executedParams).toContain('rep-1')
    })

    it('sets admitted_shelter disposition with animalId link', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        execute: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
        },
      } as any

      await completeReportWithDisposition(mockDb, 'rep-1', 'admitted_shelter', 'animal-99')

      expect(executedSql).toContain('animal_id')
      expect(executedParams).toContain('admitted_shelter')
      expect(executedParams).toContain('animal-99')
    })
  })

  describe('getRescueReports and getRescueReportById', () => {
    it('queries reports with filter for org', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        getAll: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
          return [{ id: 'rep-1', org_id: 'org-1', report_number: 'PARC-R105' }]
        },
      } as any

      const results = await getRescueReports(mockDb, 'org-1', 'new')

      expect(results).toHaveLength(1)
      expect(executedSql).toContain('SELECT * FROM rescue_reports WHERE org_id = ?')
      expect(executedSql).toContain("status = 'logged'")
      expect(executedParams).toContain('org-1')
    })

    it('queries reports with in_progress filter', async () => {
      let executedSql = ''
      const mockDb = {
        getAll: async (sql: string) => {
          executedSql = sql
          return []
        },
      } as any

      await getRescueReports(mockDb, 'org-1', 'in_progress')
      expect(executedSql).toContain("status IN ('accepted', 'dispatched')")
    })

    it('queries reports with completed filter', async () => {
      let executedSql = ''
      const mockDb = {
        getAll: async (sql: string) => {
          executedSql = sql
          return []
        },
      } as any

      await getRescueReports(mockDb, 'org-1', 'completed')
      expect(executedSql).toContain("status IN ('attended', 'cancelled')")
    })

    it('fetches report by id with getOptional', async () => {
      let executedSql = ''
      let executedParams: any[] = []
      const mockDb = {
        getOptional: async (sql: string, params: any[]) => {
          executedSql = sql
          executedParams = params
          return { id: 'rep-1', report_number: 'PARC-R101' }
        },
      } as any

      const report = await getRescueReportById(mockDb, 'rep-1')
      expect(report).not.toBeNull()
      expect(report?.id).toBe('rep-1')
      expect(executedSql).toContain('SELECT * FROM rescue_reports WHERE id = ?')
      expect(executedParams).toContain('rep-1')
    })
  })
})
