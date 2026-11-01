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
        { species: 'Dog', count: 12, child_count: 3, adult_count: 9 },
        { species: 'Cat', count: 7, child_count: 2, adult_count: 5 },
        { species: 'Donkey', count: 3, child_count: 0, adult_count: 3 },
      ],
    } as any

    const species = await getRescueSpeciesBreakdown(mockDb, 'org-1')
    expect(species).toHaveLength(3)
    expect(species[0]).toEqual({ species: 'Dog', count: 12, childCount: 3, adultCount: 9 })
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

  it('computes species breakdown expanding group_breakdown without mixed species', async () => {
    const mockDb = {
      getAll: async (sql: string) => {
        if (sql.includes('FROM rescue_reports')) {
          return [
            // Single dog adult
            { species: 'dog', animal_count: 1, life_stage: 'adult', group_breakdown: null, animal_id: 'a1' },
            // Multi-animal report with mixed species breakdown
            {
              species: 'mixed',
              animal_count: 5,
              life_stage: null,
              group_breakdown: JSON.stringify([
                { id: '1', species: 'cat', count: 3, lifeStage: 'child' },
                { id: '2', species: 'dog', count: 2, lifeStage: 'adult' },
              ]),
              animal_id: 'a2',
            },
          ]
        }
        return []
      },
    } as any

    const species = await getRescueSpeciesBreakdown(mockDb, 'org-1')
    expect(species).toHaveLength(2)

    // Cat has 3 children
    const cat = species.find((s) => s.species === 'Cat')
    expect(cat).toEqual({ species: 'Cat', count: 3, childCount: 3, adultCount: 0 })

    // Dog has 3 adults (1 single + 2 from group)
    const dog = species.find((s) => s.species === 'Dog')
    expect(dog).toEqual({ species: 'Dog', count: 3, childCount: 0, adultCount: 3 })

    // Mixed species should NOT be present in breakdown
    expect(species.find((s) => s.species.toLowerCase() === 'mixed')).toBeUndefined()
  })

  it('computes operations summary separating in-progress and resolved attended reports', async () => {
    const mockDb = {
      getAll: async (sql: string) => {
        if (sql.includes('status, COUNT(*)')) {
          return [
            { status: 'logged', count: 1 },
            { status: 'accepted', count: 1 },
            { status: 'attended', count: 6 },
          ]
        }
        if (sql.includes("status = 'attended'")) {
          return [
            // 2 attended reports completed (e.g. spot released or DOA)
            { id: 'rep-att-1', status: 'attended', disposition_type: 'spot_released', animal_id: null },
            { id: 'rep-att-2', status: 'attended', disposition_type: 'deceased_doa', animal_id: null },
            // 4 attended reports with animals in care
            { id: 'rep-att-3', status: 'attended', disposition_type: 'admitted_shelter', animal_id: 'a3' },
            { id: 'rep-att-4', status: 'attended', disposition_type: 'admitted_shelter', animal_id: 'a4' },
            { id: 'rep-att-5', status: 'attended', disposition_type: 'admitted_shelter', animal_id: 'a5' },
            { id: 'rep-att-6', status: 'attended', disposition_type: 'admitted_shelter', animal_id: 'a6' },
          ]
        }
        if (sql.includes('FROM animals a')) {
          // Animals in care (counts_as_in_care = 1)
          return [
            { id: 'a3', counts_as_in_care: 1, status_label: 'Under Treatment' },
            { id: 'a4', counts_as_in_care: 1, status_label: 'In Care' },
            { id: 'a5', counts_as_in_care: 1, status_label: 'Under Treatment' },
            { id: 'a6', counts_as_in_care: 1, status_label: 'In Care' },
          ]
        }
        if (sql.includes('FROM animal_relationships')) {
          return []
        }
        return []
      },
    } as any

    const summary = await getRescueOperationsSummary(mockDb, 'org-1')
    expect(summary.total).toBe(8)
    expect(summary.awaitingTriage).toBe(1)
    expect(summary.inField).toBe(1)
    expect(summary.attended).toBe(6)
    // 1 in-field + 4 attended in care = 5 inProgress
    expect(summary.inProgress).toBe(5)
    // 2 attended spot_released/doa = 2 resolved
    expect(summary.resolved).toBe(2)
  })
})
