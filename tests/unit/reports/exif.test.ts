import { describe, it, expect, vi } from 'vitest'
import { extractPhotoMetadata } from '@/features/reports/domain/exif'
import exifr from 'exifr'

vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(),
  },
}))

describe('extractPhotoMetadata', () => {
  it('returns null when file is invalid or null', async () => {
    // @ts-expect-error testing null input
    const result = await extractPhotoMetadata(null)
    expect(result).toBeNull()
  })

  it('extracts latitude, longitude and capturedAt when present in EXIF', async () => {
    const mockDate = new Date('2026-05-15T10:30:00Z')
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      latitude: 31.5204,
      longitude: 74.3587,
      DateTimeOriginal: mockDate,
    })

    const file = new File(['fake-jpeg-data'], 'test.jpg', { type: 'image/jpeg' })
    const result = await extractPhotoMetadata(file)

    expect(result).toEqual({
      latitude: 31.5204,
      longitude: 74.3587,
      capturedAt: mockDate.toISOString(),
    })
  })

  it('parses string dates correctly from CreateDate fallback', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      latitude: 24.8607,
      longitude: 67.0011,
      CreateDate: '2026-06-01T12:00:00Z',
    })

    const file = new File(['fake-jpeg-data'], 'test2.jpg', { type: 'image/jpeg' })
    const result = await extractPhotoMetadata(file)

    expect(result).toEqual({
      latitude: 24.8607,
      longitude: 67.0011,
      capturedAt: '2026-06-01T12:00:00.000Z',
    })
  })

  it('handles photos without GPS or date gracefully', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({})

    const file = new File(['stripped-data'], 'whatsapp.jpg', { type: 'image/jpeg' })
    const result = await extractPhotoMetadata(file)

    expect(result).toEqual({
      latitude: null,
      longitude: null,
      capturedAt: null,
    })
  })

  it('catches exifr parsing errors and returns null', async () => {
    vi.mocked(exifr.parse).mockRejectedValueOnce(new Error('Corrupt EXIF data'))

    const file = new File(['corrupt-data'], 'corrupt.jpg', { type: 'image/jpeg' })
    const result = await extractPhotoMetadata(file)

    expect(result).toBeNull()
  })
})
