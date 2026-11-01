import { describe, it, expect } from 'vitest'
import {
  searchLocationAreas,
  reverseGeocodeCoordinates,
  getAreaCentroid,
  getAllSupportedCities,
} from '@/features/reports/domain/pakistanLocations'

describe('pakistanLocations with pak-geodata', () => {
  describe('reverseGeocodeCoordinates', () => {
    it('resolves coordinates in Lahore DHA Phase 5 to nearest area and city', () => {
      // Centroid for DHA Phase 5 is around 31.4581, 74.4121
      const result = reverseGeocodeCoordinates({ latitude: 31.4581, longitude: 74.4121 })
      expect(result).not.toBeNull()
      expect(result?.areaName).toBe('DHA Phase 5')
      expect(result?.cityName).toBe('Lahore')
      expect(result?.distanceKm).toBeLessThan(1)
    })

    it('resolves coordinates in Karachi Clifton to Clifton Block', () => {
      // Clifton Block 2 is around 24.8184, 67.0305
      const result = reverseGeocodeCoordinates({ latitude: 24.8184, longitude: 67.0305 })
      expect(result).not.toBeNull()
      expect(result?.areaName).toContain('Clifton')
      expect(result?.cityName).toBe('Karachi')
    })

    it('returns null if coordinates are outside maximum distance threshold', () => {
      // In the Arabian Sea far south of Karachi
      const result = reverseGeocodeCoordinates(
        { latitude: 20.0, longitude: 65.0 },
        { maxDistanceKm: 10 }
      )
      expect(result).toBeNull()
    })
  })

  describe('searchLocationAreas', () => {
    it('finds area using colloquial alias like "dha 5"', () => {
      const results = searchLocationAreas('dha 5', { city: 'Lahore' })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toBe('DHA Phase 5')
    })

    it('finds area using Urdu script "گلبرگ"', () => {
      const results = searchLocationAreas('گلبرگ', { city: 'Lahore' })
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.name.toLowerCase().includes('gulberg'))).toBe(true)
    })

    it('scopes results to specified city when city is provided', () => {
      const lahoreResults = searchLocationAreas('Gulberg', { city: 'Lahore' })
      expect(lahoreResults.every((r) => r.cityId === 'lahore')).toBe(true)
    })
  })

  describe('getAreaCentroid', () => {
    it('returns coordinates for a known verified area', () => {
      const centroid = getAreaCentroid('DHA Phase 5', 'Lahore')
      expect(centroid).not.toBeNull()
      expect(centroid?.latitude).toBeCloseTo(31.4581, 1)
      expect(centroid?.longitude).toBeCloseTo(74.4121, 1)
    })

    it('returns coordinates even with alias name', () => {
      const centroid = getAreaCentroid('dha 5', 'Lahore')
      expect(centroid).not.toBeNull()
      expect(centroid?.latitude).toBeCloseTo(31.4581, 1)
    })

    it('returns null for an unverified or unknown area name', () => {
      const centroid = getAreaCentroid('Nonexistent Street 999', 'Lahore')
      expect(centroid).toBeNull()
    })
  })

  describe('getAllSupportedCities', () => {
    it('returns verified cities including major Pakistan metros', () => {
      const cities = getAllSupportedCities()
      expect(cities).toContain('Lahore')
      expect(cities).toContain('Karachi')
      expect(cities).toContain('Islamabad')
      expect(cities).toContain('Rawalpindi')
      expect(cities).toContain('Faisalabad')
      expect(cities.length).toBeGreaterThanOrEqual(40)
    })
  })
})
