import { describe, it, expect, vi } from 'vitest'
import {
  parseCoordinates,
  formatCoordinates,
  getNavigationUrl,
  isValidLatLng,
  requestCurrentPosition,
} from '@/features/reports/domain/coordinates'

describe('coordinates domain helpers', () => {
  describe('parseCoordinates', () => {
    it('returns null for empty or null input', () => {
      expect(parseCoordinates('')).toBeNull()
      expect(parseCoordinates(null)).toBeNull()
      expect(parseCoordinates('   ')).toBeNull()
    })

    it('parses raw comma-separated coordinates', () => {
      expect(parseCoordinates('24.860734, 67.001137')).toEqual({
        latitude: 24.860734,
        longitude: 67.001137,
      })
      expect(parseCoordinates('24.860734,67.001137')).toEqual({
        latitude: 24.860734,
        longitude: 67.001137,
      })
    })

    it('parses Google Maps ?q= query param link', () => {
      const url = 'https://maps.google.com/?q=24.860734,67.001137'
      expect(parseCoordinates(url)).toEqual({
        latitude: 24.860734,
        longitude: 67.001137,
      })
    })

    it('parses WhatsApp shared message with Google Maps link', () => {
      const msg = 'Follow this link to see my location: https://maps.google.com/?q=24.860734,67.001137'
      expect(parseCoordinates(msg)).toEqual({
        latitude: 24.860734,
        longitude: 67.001137,
      })
    })

    it('parses Google Maps @lat,lng path notation', () => {
      const url = 'https://www.google.com/maps/place/Burns+Road/@24.860734,67.001137,17z/data=!3m1!4b1'
      expect(parseCoordinates(url)).toEqual({
        latitude: 24.860734,
        longitude: 67.001137,
      })
    })

    it('rejects invalid latitude and longitude ranges', () => {
      expect(parseCoordinates('95.0, 190.0')).toBeNull()
      expect(parseCoordinates('abc, def')).toBeNull()
    })
  })

  describe('formatCoordinates', () => {
    it('formats coordinates with cardinal directions', () => {
      expect(formatCoordinates(24.860734, 67.001137)).toBe('24.8607° N, 67.0011° E')
      expect(formatCoordinates(-33.8688, 151.2093)).toBe('33.8688° S, 151.2093° E')
    })

    it('returns empty string if either coordinate is null or undefined', () => {
      expect(formatCoordinates(null, 67.0011)).toBe('')
      expect(formatCoordinates(24.8607, null)).toBe('')
    })
  })

  describe('getNavigationUrl', () => {
    it('creates google maps turn-by-turn navigation link', () => {
      expect(getNavigationUrl(24.8607, 67.0011)).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=24.8607,67.0011',
      )
    })
  })

  describe('isValidLatLng', () => {
    it('validates lat between -90 and 90 and lng between -180 and 180', () => {
      expect(isValidLatLng(24.86, 67.0)).toBe(true)
      expect(isValidLatLng(91, 67.0)).toBe(false)
      expect(isValidLatLng(24.86, 185)).toBe(false)
    })
  })

  describe('requestCurrentPosition', () => {
    it('resolves coordinates from navigator.geolocation', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn().mockImplementation((success) => {
          success({
            coords: {
              latitude: 24.860734,
              longitude: 67.001137,
            },
          })
        }),
      }
      vi.stubGlobal('navigator', { geolocation: mockGeolocation })

      const coords = await requestCurrentPosition()
      expect(coords).toEqual({ latitude: 24.860734, longitude: 67.001137 })
      vi.unstubAllGlobals()
    })

    it('rejects with descriptive error if permission is denied', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn().mockImplementation((_, error) => {
          error({ code: 1, message: 'User denied' })
        }),
      }
      vi.stubGlobal('navigator', { geolocation: mockGeolocation })

      await expect(requestCurrentPosition()).rejects.toThrow('Location permission was denied')
      vi.unstubAllGlobals()
    })
  })
})
