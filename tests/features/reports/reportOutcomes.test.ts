import { describe, it, expect, vi } from 'vitest'
import { getReportCompletionStatus } from '@/features/reports/domain/reportOutcomes'
import type { RescueReport } from '@/features/reports/domain/rescueReports'

describe('getReportCompletionStatus', () => {
  it('returns completed for spot_released reports without animal', async () => {
    const report: Partial<RescueReport> = {
      id: 'r1',
      status: 'attended',
      disposition_type: 'spot_released',
      animal_id: null,
    }
    const result = await getReportCompletionStatus({} as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Spot Released')
  })

  it('returns in-progress if primary linked animal is still in care', async () => {
    const mockDb = {
      getAll: vi.fn().mockResolvedValue([]), // no companions
      getOptional: vi.fn().mockResolvedValue({
        id: 'a1',
        counts_as_in_care: 1,
        status_label: 'Under Treatment',
      }),
    }
    const report: Partial<RescueReport> = {
      id: 'r2',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(false)
    expect(result.outcomeLabel).toBe('Under Treatment')
  })

  it('returns completed when all linked animals (primary + companions) have exit status', async () => {
    const mockDb = {
      // Primary animal
      getOptional: vi.fn().mockResolvedValue({
        id: 'a1',
        counts_as_in_care: 0,
        status_label: 'Transferred',
      }),
      // Companions
      getAll: vi.fn().mockResolvedValue([
        { id: 'a2', counts_as_in_care: 0, status_label: 'Transferred' },
      ]),
    }
    const report: Partial<RescueReport> = {
      id: 'r3',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Transferred')
  })

  it('returns in-progress if one of multiple animals is still in care', async () => {
    const mockDb = {
      getOptional: vi.fn().mockResolvedValue({
        id: 'a1',
        counts_as_in_care: 0,
        status_label: 'Adopted',
      }),
      getAll: vi.fn().mockResolvedValue([
        { id: 'a2', counts_as_in_care: 1, status_label: 'Under Treatment' },
      ]),
    }
    const report: Partial<RescueReport> = {
      id: 'r4',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(false)
  })

  it('returns completed for cancelled reports without animal', async () => {
    const report: Partial<RescueReport> = {
      id: 'r5',
      status: 'cancelled',
      animal_id: null,
    }
    const result = await getReportCompletionStatus({} as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Cancelled')
  })

  it('returns completed for deceased_doa reports', async () => {
    const report: Partial<RescueReport> = {
      id: 'r6',
      status: 'attended',
      disposition_type: 'deceased_doa',
      animal_id: null,
    }
    const result = await getReportCompletionStatus({} as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Dead on Arrival (DOA)')
  })

  it('returns in-progress for logged reports without linked animal', async () => {
    const report: Partial<RescueReport> = {
      id: 'r7',
      status: 'logged',
      animal_id: null,
    }
    const result = await getReportCompletionStatus({} as any, report as RescueReport)
    expect(result.isCompleted).toBe(false)
    expect(result.outcomeLabel).toBe('Logged')
  })

  it('combines unique exit labels when multiple animals have different exit outcomes', async () => {
    const mockDb = {
      getOptional: vi.fn().mockResolvedValue({
        id: 'a1',
        counts_as_in_care: 0,
        status_label: 'Adopted',
      }),
      getAll: vi.fn().mockResolvedValue([
        { id: 'a2', counts_as_in_care: 0, status_label: 'Transferred' },
      ]),
    }
    const report: Partial<RescueReport> = {
      id: 'r8',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Adopted, Transferred')
    expect(result.completedCount).toBe(2)
    expect(result.activeCount).toBe(0)
  })

  it('returns completed for transferred_partner reports without animal record', async () => {
    const report: Partial<RescueReport> = {
      id: 'r9',
      status: 'attended',
      disposition_type: 'transferred_partner',
      animal_id: null,
    }
    const result = await getReportCompletionStatus({} as any, report as RescueReport)
    expect(result.isCompleted).toBe(true)
    expect(result.outcomeLabel).toBe('Transferred')
  })

  it('handles database query exceptions gracefully', async () => {
    const mockDb = {
      getOptional: vi.fn().mockRejectedValue(new Error('DB failure')),
      getAll: vi.fn().mockRejectedValue(new Error('DB failure')),
    }
    const report: Partial<RescueReport> = {
      id: 'r10',
      status: 'attended',
      disposition_type: 'admitted_shelter',
      animal_id: 'a1',
    }
    const result = await getReportCompletionStatus(mockDb as any, report as RescueReport)
    expect(result.isCompleted).toBe(false)
    expect(result.outcomeLabel).toBe('Attended')
  })
})
