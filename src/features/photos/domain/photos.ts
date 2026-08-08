import type { SanctuaryDb } from '@/shared/lib/db'
import type { PhotoRecord } from '@/features/sync/powersync/schema'
import { compressImage } from '@/shared/lib/r2/upload'

const PHOTO_CACHE = 'sanctuary-photos-v1'

async function photoStore(): Promise<Cache> {
  return caches.open(PHOTO_CACHE)
}

export function localPhotoUrl(photoId: string): string {
  return `/__local_photos__/${photoId}`
}

export async function storeLocalPhoto(
  photoId: string,
  blob: Blob,
): Promise<void> {
  const cache = await photoStore()
  await cache.put(
    localPhotoUrl(photoId),
    new Response(blob, {
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
    }),
  )
}

export async function getLocalPhoto(photoId: string): Promise<Blob | null> {
  const cache = await photoStore()
  const res = await cache.match(localPhotoUrl(photoId))
  if (!res) return null
  return res.blob()
}

export async function deleteLocalPhoto(photoId: string): Promise<void> {
  const cache = await photoStore()
  await cache.delete(localPhotoUrl(photoId))
}

export async function deletePhoto(
  db: SanctuaryDb,
  photoId: string,
): Promise<void> {
  await deleteLocalPhoto(photoId)
  await db.execute(`DELETE FROM photos WHERE id = ?`, [photoId])
}

export async function queuePhoto(
  db: SanctuaryDb,
  input: { orgId: string; animalId: string; blob: Blob },
): Promise<PhotoRecord> {
  const compressed = await compressImage(input.blob)
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await storeLocalPhoto(id, compressed)
  await db.execute(
    `INSERT INTO photos (id, org_id, animal_id, r2_key, local_only, upload_state, created_at)
     VALUES (?, ?, ?, NULL, 1, 'pending', ?)`,
    [id, input.orgId, input.animalId, created_at],
  )

  return {
    id,
    org_id: input.orgId,
    animal_id: input.animalId,
    r2_key: null,
    local_only: 1,
    upload_state: 'pending',
    created_at,
  }
}

export async function countPendingPhotos(
  db: SanctuaryDb,
  orgId: string,
): Promise<number> {
  const row = await db.getOptional<{ n: number }>(
    `SELECT COUNT(*) as n FROM photos WHERE org_id = ? AND upload_state IN ('pending', 'failed')`,
    [orgId],
  )
  return row?.n ?? 0
}

export async function listPhotosForAnimal(
  db: SanctuaryDb,
  animalId: string,
): Promise<PhotoRecord[]> {
  return db.getAll<PhotoRecord>(
    `SELECT * FROM photos WHERE animal_id = ? ORDER BY created_at DESC`,
    [animalId],
  )
}

export async function processPhotoQueue(
  db: SanctuaryDb,
): Promise<{ uploaded: number; failed: number }> {
  const { requestSignedUpload } = await import('@/shared/lib/r2/upload')
  const pending = await db.getAll<PhotoRecord>(
    `SELECT * FROM photos WHERE upload_state IN ('pending', 'failed') ORDER BY created_at ASC LIMIT 10`,
  )

  let uploaded = 0
  let failed = 0

  for (const photo of pending) {
    try {
      await db.execute(
        `UPDATE photos SET upload_state = 'uploading' WHERE id = ?`,
        [photo.id],
      )
      const blob = await getLocalPhoto(photo.id)
      if (!blob) {
        throw new Error(`Local photo missing for ${photo.id}`)
      }
      const key = `${photo.org_id}/${photo.animal_id}/${photo.id}.jpg`
      const { uploadUrl, publicUrl } = await requestSignedUpload(key)
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
      })
      if (!put.ok) {
        throw new Error(`R2 upload failed: ${put.status}`)
      }
      await db.execute(
        `UPDATE photos SET r2_key = ?, local_only = 0, upload_state = 'uploaded' WHERE id = ?`,
        [publicUrl || key, photo.id],
      )
      uploaded += 1
    } catch (err) {
      console.warn('Photo upload failed:', err)
      await db.execute(
        `UPDATE photos SET upload_state = 'failed' WHERE id = ?`,
        [photo.id],
      )
      failed += 1
    }
  }

  return { uploaded, failed }
}
