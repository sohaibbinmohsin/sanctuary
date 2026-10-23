import type { StagedPhoto } from '@/features/animals/components/IntakePhotoPicker'

let pendingIntakePhotos: StagedPhoto[] = []

/**
 * Stages one or more photos into the in-memory intake queue.
 * These will be consumed and displayed when AnimalIntakeScreen mounts.
 */
export function stageIntakePhotos(
  files: (File | Blob)[],
  captureSource: 'camera' | 'gallery' = 'camera',
): StagedPhoto[] {
  const newPhotos: StagedPhoto[] = files.map((file) => ({
    id: crypto.randomUUID(),
    blob: file,
    previewUrl: URL.createObjectURL(file),
    captureSource,
  }))
  pendingIntakePhotos = [...pendingIntakePhotos, ...newPhotos]
  return newPhotos
}

/**
 * Returns and removes all pending intake photos from the queue.
 */
export function consumePendingIntakePhotos(): StagedPhoto[] {
  const photos = pendingIntakePhotos
  pendingIntakePhotos = []
  return photos
}

/**
 * Peeks at pending intake photos without removing them.
 */
export function peekPendingIntakePhotos(): StagedPhoto[] {
  return pendingIntakePhotos
}

/**
 * Clears and revokes all pending intake photos in the queue.
 */
export function clearPendingIntakePhotos(): void {
  for (const p of pendingIntakePhotos) {
    URL.revokeObjectURL(p.previewUrl)
  }
  pendingIntakePhotos = []
}
