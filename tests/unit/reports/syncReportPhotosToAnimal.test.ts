import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deterministicUuid,
  syncReportPhotosToAnimal,
} from '@/features/reports/domain/rescueReports'

describe('syncReportPhotosToAnimal & deterministicUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deterministicUuid', () => {
    it('produces valid UUID format matching RFC 4122', async () => {
      const id = await deterministicUuid('animal-123', 'photo-456')
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('is deterministic for the same namespace and name', async () => {
      const id1 = await deterministicUuid('animal-123', 'photo-456')
      const id2 = await deterministicUuid('animal-123', 'photo-456')
      expect(id1).toBe(id2)
    })

    it('produces different UUIDs for different inputs', async () => {
      const id1 = await deterministicUuid('animal-123', 'photo-456')
      const id2 = await deterministicUuid('animal-123', 'photo-789')
      expect(id1).not.toBe(id2)
    })
  })

  describe('syncReportPhotosToAnimal', () => {
    it('inserts animal photo with capture_source = gallery and valid upload_state', async () => {
      const executeCalls: { sql: string; params: any[] }[] = []
      const mockDb = {
        getAll: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM report_photos')) {
            return [
              {
                id: 'rp-1',
                org_id: 'org-1',
                report_id: 'rep-1',
                r2_key: null,
                local_only: 1,
                upload_state: 'pending',
                created_at: '2026-10-25T10:00:00Z',
              },
            ]
          }
          if (sql.includes('FROM photos')) {
            return [] // no existing photos for animal
          }
          return []
        }),
        execute: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          executeCalls.push({ sql, params })
        }),
      } as any

      await syncReportPhotosToAnimal(mockDb, 'rep-1', 'animal-1', 'org-1')

      expect(executeCalls.length).toBe(1)
      const insertCall = executeCalls[0]
      expect(insertCall.sql).toContain('INSERT INTO photos')
      // Ensure capture_source is 'gallery', NOT 'upload'
      expect(insertCall.params[6]).toBe('gallery')
      // Ensure upload_state is 'pending'
      expect(insertCall.params[5]).toBe('pending')
      // Ensure animal_id is set
      expect(insertCall.params[2]).toBe('animal-1')
    })

    it('is idempotent and skips already synced photos', async () => {
      const detId = await deterministicUuid('animal-1', 'rp-1')
      const executeCalls: { sql: string; params: any[] }[] = []
      const mockDb = {
        getAll: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM report_photos')) {
            return [
              {
                id: 'rp-1',
                org_id: 'org-1',
                report_id: 'rep-1',
                r2_key: 'https://r2.example.com/photo.jpg',
                local_only: 0,
                upload_state: 'uploaded',
                created_at: '2026-10-25T10:00:00Z',
              },
            ]
          }
          if (sql.includes('FROM photos')) {
            return [{ id: detId, r2_key: 'https://r2.example.com/photo.jpg' }]
          }
          return []
        }),
        execute: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          executeCalls.push({ sql, params })
        }),
      } as any

      await syncReportPhotosToAnimal(mockDb, 'rep-1', 'animal-1', 'org-1')

      // Should not insert duplicate photo
      const inserts = executeCalls.filter((c) => c.sql.includes('INSERT INTO photos'))
      expect(inserts.length).toBe(0)
    })
  })
})
