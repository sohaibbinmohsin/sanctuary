import { describe, it, expect } from 'vitest'
import {
  PAKISTAN_CITIES,
  LAHORE_AREAS,
  getAreasForCity,
  filterAreas,
  filterCities,
} from '@/features/reports/domain/pakistanLocations'

describe('pakistanLocations', () => {
  it('contains Lahore as the primary city and has comprehensive Lahore areas', () => {
    expect(PAKISTAN_CITIES).toContain('Lahore')
    expect(PAKISTAN_CITIES[0]).toBe('Lahore')
    expect(LAHORE_AREAS.length).toBeGreaterThan(50)
    expect(LAHORE_AREAS).toContain('Gulberg III')
    expect(LAHORE_AREAS).toContain('DHA Phase 5')
    expect(LAHORE_AREAS).toContain('Model Town Block C')
    expect(LAHORE_AREAS).toContain('Johar Town Phase 1')
  })

  it('filters cities by query', () => {
    const lahoreMatch = filterCities('lah')
    expect(lahoreMatch).toContain('Lahore')

    const karachiMatch = filterCities('kar')
    expect(karachiMatch).toContain('Karachi')
  })

  it('filters areas for Lahore and supports search', () => {
    const gulbergAreas = filterAreas('Lahore', 'gulberg')
    expect(gulbergAreas.length).toBeGreaterThan(0)
    expect(gulbergAreas).toContain('Gulberg III')

    const dhaAreas = filterAreas('Lahore', 'dha')
    expect(dhaAreas).toContain('DHA Phase 6')
  })

  it('returns empty list for cities without preset directories while allowing custom inputs', () => {
    const custom = getAreasForCity('Swabi')
    expect(custom).toEqual([])
  })
})
