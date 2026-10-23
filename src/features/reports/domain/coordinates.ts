/**
 * Zero-cost coordinate extraction and formatting utilities.
 * Extracts latitude and longitude from raw strings, WhatsApp shared location text,
 * and Google Maps URLs without requiring any paid APIs.
 */

export type Coordinates = {
  latitude: number
  longitude: number
}

/**
 * Parses coordinates from text, links, or comma-separated numbers.
 * Supported patterns:
 * - Direct: "24.860734, 67.001137" or "24.860734 67.001137"
 * - Query param: "https://maps.google.com/?q=24.860734,67.001137"
 * - At-notation: "https://www.google.com/maps/@24.860734,67.001137,17z"
 * - LL param: "https://maps.google.com/maps?ll=24.860734,67.001137"
 * - WhatsApp text: "Location: https://maps.google.com/?q=24.860734,67.001137"
 */
export function parseCoordinates(input?: string | null): Coordinates | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // 1. Google Maps query param ?q=lat,lng or ?daddr=lat,lng
  const qMatch = trimmed.match(/[?&](?:q|daddr|destination)=([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)/i)
  if (qMatch) {
    const lat = parseFloat(qMatch[1])
    const lng = parseFloat(qMatch[2])
    if (isValidLatLng(lat, lng)) return { latitude: roundCoord(lat), longitude: roundCoord(lng) }
  }

  // 2. Google Maps @lat,lng notation (e.g. /@24.860734,67.001137,17z)
  const atMatch = trimmed.match(/@([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)/)
  if (atMatch) {
    const lat = parseFloat(atMatch[1])
    const lng = parseFloat(atMatch[2])
    if (isValidLatLng(lat, lng)) return { latitude: roundCoord(lat), longitude: roundCoord(lng) }
  }

  // 3. Google Maps ll=lat,lng
  const llMatch = trimmed.match(/[?&]ll=([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)/i)
  if (llMatch) {
    const lat = parseFloat(llMatch[1])
    const lng = parseFloat(llMatch[2])
    if (isValidLatLng(lat, lng)) return { latitude: roundCoord(lat), longitude: roundCoord(lng) }
  }

  // 4. Raw comma or space separated numbers: "24.8607, 67.0011"
  const rawMatch = trimmed.match(/^([+-]?\d{1,2}(?:\.\d+)?)[,\s]+([+-]?\d{1,3}(?:\.\d+)?)$/)
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1])
    const lng = parseFloat(rawMatch[2])
    if (isValidLatLng(lat, lng)) return { latitude: roundCoord(lat), longitude: roundCoord(lng) }
  }

  // 5. Look for any lat, lng pair embedded in a WhatsApp message or link
  const embedMatch = trimmed.match(/([+-]?\d{1,2}\.\d{3,})[,\s]+([+-]?\d{1,3}\.\d{3,})/)
  if (embedMatch) {
    const lat = parseFloat(embedMatch[1])
    const lng = parseFloat(embedMatch[2])
    if (isValidLatLng(lat, lng)) return { latitude: roundCoord(lat), longitude: roundCoord(lng) }
  }

  return null
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function roundCoord(val: number): number {
  return Math.round(val * 1000000) / 1000000
}

/**
 * Formats coordinates for clean human-readable UI display.
 * e.g. "24.8607° N, 67.0011° E"
 */
export function formatCoordinates(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return ''
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  const absLat = Math.abs(lat).toFixed(4)
  const absLng = Math.abs(lng).toFixed(4)
  return `${absLat}° ${latDir}, ${absLng}° ${lngDir}`
}

/**
 * Builds a direct navigation link for ambulance drivers.
 * Uses the free Google Maps / Apple Maps deep link protocol.
 * Costs $0 because it opens the driver's native mapping application.
 */
export function getNavigationUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/**
 * Acquires current position using the standard browser Geolocation API.
 * 100% free, runs client-side with device GPS/cell triangulation.
 */
export function requestCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser or device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: roundCoord(pos.coords.latitude),
          longitude: roundCoord(pos.coords.longitude),
        })
      },
      (err) => {
        let msg = 'Failed to get location.'
        if (err.code === 1) {
          msg = 'Location permission was denied. Please allow location access in your browser settings.'
        } else if (err.code === 2) {
          msg = 'Position unavailable. Check your device GPS or internet connection.'
        } else if (err.code === 3) {
          msg = 'Location request timed out. Please try again.'
        }
        reject(new Error(msg))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    )
  })
}
