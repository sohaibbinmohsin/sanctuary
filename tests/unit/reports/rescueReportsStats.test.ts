import { describe, it, expect } from 'vitest'
import {
  getRescueOperationsSummary,
  getRescueCategoryBreakdown,
  getRescueSpeciesBreakdown,
  getRescueHotspots,
  getRescueMonthlyTrend,
} from '@/features/reports/domain/rescueReports'

describe('rescueReports stats functions', () => {
  it('computes operations summary correctly', async () => {
    const mockDb = {
      getAll: async (sql: string) => {
        if (sql.includes('status, COUNT(*)')) {
          return [
            { status: 'logged', count: 3 },
            { status: 'accepted', count: 2 },
            { status: 'dispatched', count: 4 },
            { status: 'attended', count: 10 },
            { status: 'cancelled', count: 1 },
          ]
        }
        return []
      },
    } as any

    const summary = await getRescueOperationsSummary(mockDb, 'org-1')
    expect(summary.total).toBe(20)
    expect(summary.inField).toBe(6) // accepted + dispatched
    expect(summary.attended).toBe(10)
    expect(summary.awaitingTriage).toBe(3) // logged
    expect(summary.cancelled).toBe(1)
  })

  it('computes category breakdown correctly', async () => {
    const mockDb = {
      getAll: async (sql: string) => {
        if (sql.includes('category, COUNT(*)')) {
          return [
            { category: 'emergency', count: 15 },
            { category: 'cruelty', count: 5 },
          ]
        }
        if (sql.includes('legal_notes')) {
          return [{ count: 3 }]
        }
        if (sql.includes('dismissal_reason')) {
          return [{ count: 1 }]
        }
        return []
      },
    } as any

    const breakdown = await getRescueCategoryBreakdown(mockDb, 'org-1')
    expect(breakdown.emergency).toBe(15)
    expect(breakdown.cruelty).toBe(5)
    expect(breakdown.crueltyLegalNotice).toBe(3)
    expect(breakdown.crueltyDismissed).toBe(1)
  })

  it('computes species breakdown ordered by count', async () => {
    const mockDb = {
      getAll: async () => [
        { species: 'Dog', count: 12 },
        { species: 'Cat', count: 7 },
        { species: 'Donkey', count: 3 },
      ],
    } as any

    const species = await getRescueSpeciesBreakdown(mockDb, 'org-1')
    expect(species).toHaveLength(3)
    expect(species[0]).toEqual({ species: 'Dog', count: 12 })
  })

  it('computes hotspots ordered by incident count', async () => {
    const mockDb = {
      getAll: async () => [
        { location_area: 'Gulberg', city: 'Lahore', count: 8 },
        { location_area: 'DHA Phase 5', city: 'Lahore', count: 5 },
      ],
    } as any

    const hotspots = await getRescueHotspots(mockDb, 'org-1', 5)
    expect(hotspots).toHaveLength(2)
    expect(hotspots[0].area).toBe('Gulberg')
    expect(hotspots[0].city).toBe('Lahore')
    expect(hotspots[0].count).toBe(8)
  })

  it('computes monthly trend for past months', async () => {
    const mockDb = {
      getAll: async () => [
        { month: '2026-10', count: 14 },
      ],
    } as any

    const trend = await getRescueMonthlyTrend(mockDb, 'org-1', 6)
    expect(trend).toHaveLength(6)
    const oct = trend.find((t) => t.month === '2026-10')
    expect(oct?.count).toBe(14)
  })
})
