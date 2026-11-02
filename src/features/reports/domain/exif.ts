import exifr from 'exifr'

export interface PhotoExifMetadata {
  latitude: number | null
  longitude: number | null
  capturedAt: string | null
}

export async function extractPhotoMetadata(file: Blob | File): Promise<PhotoExifMetadata | null> {
  if (!file) return null

  try {
    const output = await exifr.parse(file, {
      gps: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'],
    })

    if (!output) return null

    let capturedAt: string | null = null
    const rawDate = output.DateTimeOriginal || output.CreateDate
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      capturedAt = rawDate.toISOString()
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      const parsed = new Date(rawDate)
      if (!isNaN(parsed.getTime())) {
        capturedAt = parsed.toISOString()
      }
    }

    const lat = typeof output.latitude === 'number' && !isNaN(output.latitude) ? output.latitude : null
    const lon = typeof output.longitude === 'number' && !isNaN(output.longitude) ? output.longitude : null

    return {
      latitude: lat,
      longitude: lon,
      capturedAt,
    }
  } catch {
    return null
  }
}
