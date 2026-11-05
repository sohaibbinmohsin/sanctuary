/**
 * Pakistan cities and neighborhood/area directories powered exclusively by pak-geodata.
 * Single source of truth for offline-first autocomplete and geocoding in rescue reports.
 */
import {
  getAllCities,
  getCityById,
  getAreasByCity,
  searchAreas,
  getNearestArea,
  haversineDistanceKm,
  type PakistanArea,
  type PakistanCity,
} from 'pak-geodata'

export type { PakistanArea, PakistanCity }
import { toSentenceCase } from '@/shared/lib/text'

// Canonical city and area list derived dynamically from pak-geodata
const PRIORITY_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi']
export const PAKISTAN_CITIES: readonly string[] = [
  ...PRIORITY_CITIES.filter((name) => getAllCities().some((c) => c.name === name)),
  ...getAllCities()
    .map((c) => c.name)
    .filter((name) => !PRIORITY_CITIES.includes(name))
    .sort((a, b) => a.localeCompare(b)),
]
export const LAHORE_AREAS: readonly string[] = getAreasByCity('lahore').map((a) => a.name)

/**
 * Normalizes user input city string to canonical pak-geodata cityId.
 */
export function toCityId(cityName?: string | null): string | undefined {
  if (!cityName) return undefined
  const cleaned = cityName
    .trim()
    .toLowerCase()
    .replace(/[\(\)]/g, '')
    .replace(/\s+/g, '-')
  const cities = getAllCities()
  const found = cities.find(
    (c) =>
      c.id === cleaned ||
      c.name.toLowerCase() === cityName.trim().toLowerCase() ||
      c.district.toLowerCase() === cityName.trim().toLowerCase()
  )
  return found ? found.id : cleaned
}

export interface ReverseGeocodeResult {
  areaName: string
  cityName: string
  provinceId?: string
  distanceKm: number
  coordinates: { latitude: number; longitude: number }
}

/**
 * Resolves geographic coordinates (lat, lng) to the closest verified area and city in Pakistan.
 * Uses offline spherical Haversine nearest neighbor calculations with zero network latency.
 */
export function reverseGeocodeCoordinates(
  coords: { latitude: number; longitude: number },
  options?: { maxDistanceKm?: number; city?: string | null }
): ReverseGeocodeResult | null {
  const cityId = toCityId(options?.city)
  let nearest = getNearestArea(
    { lat: coords.latitude, lng: coords.longitude },
    { cityId, maxDistanceKm: options?.maxDistanceKm ?? 15 }
  )
  if (!nearest && cityId) {
    nearest = getNearestArea(
      { lat: coords.latitude, lng: coords.longitude },
      { maxDistanceKm: options?.maxDistanceKm ?? 25 }
    )
  }
  if (!nearest) return null

  const cityObj = getCityById(nearest.cityId)
  const cityName = cityObj ? cityObj.name : toSentenceCase(nearest.cityId)
  const dist = haversineDistanceKm(
    { lat: coords.latitude, lng: coords.longitude },
    nearest.coordinates
  )

  return {
    areaName: nearest.name,
    cityName,
    provinceId: nearest.provinceId,
    distanceKm: Math.round(dist * 10) / 10,
    coordinates: {
      latitude: nearest.coordinates.lat,
      longitude: nearest.coordinates.lng,
    },
  }
}

/**
 * Searches Pakistan areas using structured multi-script matching and alias ranking.
 * Supports colloquial aliases (e.g. "dha 5", "gulberg 3") and Urdu script.
 */
export function searchLocationAreas(
  query: string,
  options?: { city?: string | null; limit?: number }
): PakistanArea[] {
  const cityId = toCityId(options?.city)
  return searchAreas(query, { cityId, limit: options?.limit ?? 25 })
}

const COMMON_AREA_ALIASES: Record<string, string> = {
  thoker: 'Thokar Niaz Baig',
  thokhar: 'Thokar Niaz Baig',
  thokr: 'Thokar Niaz Baig',
  'daewo express thoker': 'Thokar Niaz Baig',
  margzar: 'Marghzar Colony',
  'green twon': 'Green Town',
  'bank stop': 'Waltan',
}

/**
 * Looks up the verified centroid GPS coordinates for a given area name or alias.
 */
export function getAreaCentroid(
  areaName: string,
  cityName?: string | null
): { latitude: number; longitude: number } | null {
  if (!areaName || !areaName.trim()) return null
  const qLower = areaName.trim().toLowerCase()
  const lookupName = COMMON_AREA_ALIASES[qLower] || areaName
  const matches = searchLocationAreas(lookupName, { city: cityName, limit: 1 })
  if (matches.length > 0) {
    const top = matches[0]
    const targetLower = lookupName.trim().toLowerCase()
    const isExact = top.name.toLowerCase() === targetLower
    const isAlias = top.aliases.some((a: string) => a.toLowerCase() === targetLower)
    const isPrefix = top.name.toLowerCase().startsWith(targetLower) || targetLower.startsWith(top.name.toLowerCase())
    if (isExact || isAlias || isPrefix) {
      return {
        latitude: top.coordinates.lat,
        longitude: top.coordinates.lng,
      }
    }
  }
  return null
}

/**
 * Checks whether the specified coordinates match the known centroid of the area.
 * Useful for determining whether to render an area boundary marking instead of a pinpoint GPS fix.
 */
export function isCentroidCoordinates(
  lat?: number | null,
  lng?: number | null,
  areaName?: string | null,
  cityName?: string | null,
): boolean {
  if (lat == null || lng == null || !areaName || !areaName.trim()) return false
  const centroid = getAreaCentroid(areaName, cityName)
  if (!centroid) return false
  return (
    Math.abs(centroid.latitude - lat) < 0.0005 &&
    Math.abs(centroid.longitude - lng) < 0.0005
  )
}

/**
 * Returns all verified cities in Pakistan from pak-geodata.
 */
export function getAllSupportedCities(): readonly string[] {
  return getAllCities().map((c) => c.name)
}

/**
 * Returns preset areas for a given city name (case-insensitive) directly from pak-geodata.
 */
export function getAreasForCity(cityName?: string | null): readonly string[] {
  if (!cityName || !cityName.trim()) {
    return LAHORE_AREAS
  }
  const cityId = toCityId(cityName)
  return cityId ? getAreasByCity(cityId).map((a) => a.name) : []
}

/**
 * Searches and filters areas for a city given a search query directly from pak-geodata.
 */
export function filterAreas(cityName: string | undefined | null, query: string): string[] {
  const q = query.trim()
  if (!q) {
    return [...getAreasForCity(cityName).slice(0, 50)]
  }
  return searchLocationAreas(q, { city: cityName, limit: 25 }).map((a) => a.name)
}

/**
 * Filters Pakistan cities given a search query directly from pak-geodata.
 */
export function filterCities(query: string): string[] {
  const q = query.trim().toLowerCase()
  const allCities = getAllSupportedCities()
  if (!q) return [...allCities]
  return allCities.filter((c) => c.toLowerCase().includes(q))
}
