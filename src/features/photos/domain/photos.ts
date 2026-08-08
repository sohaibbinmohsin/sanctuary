import type { SanctuaryDb } from '@/shared/lib/db'
import type { PhotoRecord } from '@/features/sync/powersync/schema'
import {
  compressImage,
  requestR2Delete,
  r2ObjectKey,
} from '@/shared/lib/r2/upload'

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

async function deleteRemotePhoto(photo: {
  id: string
  org_id: string
  animal_id: string
  r2_key: string | null
  upload_state?: string | null
}): Promise<void> {
  const uploaded =
    photo.upload_state === 'uploaded' || Boolean(photo.r2_key)
  if (!uploaded) return
  if (!navigator.onLine) {
    throw new Error(
      'Connect to the internet to delete photos from cloud storage.',
    )
  }
  const key = r2ObjectKey(photo.r2_key, {
    orgId: photo.org_id,
    animalId: photo.animal_id,
    photoId: photo.id,
  })
  if (!key) return
  await requestR2Delete(key)
}

export async function deletePhoto(
  db: SanctuaryDb,
  photoId: string,
): Promise<void> {
  const photo = await db.getOptional<PhotoRecord>(
    `SELECT * FROM photos WHERE id = ?`,
    [photoId],
  )
  if (photo) {
    await deleteRemotePhoto(photo)
  }
  await deleteLocalPhoto(photoId)
  await db.execute(`DELETE FROM photos WHERE id = ?`, [photoId])
}

export async function deletePhotosForAnimal(
  db: SanctuaryDb,
  animalId: string,
): Promise<void> {
  const rows = await db.getAll<PhotoRecord>(
    `SELECT * FROM photos WHERE animal_id = ?`,
    [animalId],
  )
  for (const row of rows) {
    await deletePhoto(db, row.id)
  }
}

/** Drop queued uploads whose animal was removed/archived (or no longer exists). */
export async function purgeOrphanedPendingPhotos(
  db: SanctuaryDb,
): Promise<number> {
  const orphans = await db.getAll<{ id: string }>(
    `SELECT p.id FROM photos p
     LEFT JOIN animals a ON a.id = p.animal_id
     WHERE p.upload_state IN ('pending', 'failed', 'uploading')
       AND (a.id IS NULL OR a.archived = 1)`,
  )
  for (const row of orphans) {
    await deletePhoto(db, row.id)
  }
  return orphans.length
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
  animalId?: string,
): Promise<number> {
  if (animalId) {
    const row = await db.getOptional<{ n: number }>(
      `SELECT COUNT(*) as n FROM photos
       WHERE org_id = ? AND animal_id = ? AND upload_state IN ('pending', 'failed')`,
      [orgId, animalId],
    )
    return row?.n ?? 0
  }
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
  await purgeOrphanedPendingPhotos(db)
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
      // Do not set Content-Type — the presigned URL signs only `host`.
      // Extra headers cause R2 SignatureDoesNotMatch / CORS preflight failures.
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
      })
      if (!put.ok) {
        const detail = (await put.text().catch(() => '')).slice(0, 200)
        throw new Error(
          `R2 upload failed: ${put.status}${detail ? ` ${detail}` : ''}`,
        )
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
