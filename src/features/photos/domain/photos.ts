import type { SanctuaryDb } from '@/shared/lib/db'
import type { PhotoRecord } from '@/features/sync/powersync/schema'
import {
  compressImage,
  requestR2Delete,
  r2ObjectKey,
} from '@/shared/lib/r2/upload'

const PHOTO_CACHE = 'sanctuary-photos-v1'

// In-memory only — never synced/persisted. Capture tokens are single-use
// secrets minted by the `capture-session` edge function for verified
// in-app camera captures; they live only long enough to be handed to
// `r2-sign` on next upload attempt.
const pendingCaptureTokens = new Map<string, string>()

export function rememberCaptureToken(photoId: string, token: string): void {
  pendingCaptureTokens.set(photoId, token)
}

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

async function deleteRemotePhoto(photo: PhotoRecord): Promise<void> {
  const uploaded =
    photo.upload_state === 'uploaded' || Boolean(photo.r2_key)
  if (!uploaded) return
  if (!navigator.onLine) {
    throw new Error(
      'Connect to the internet to delete photos from cloud storage.',
    )
  }
  const key = r2ObjectKey(
    photo.r2_key,
    photo.org_id && photo.animal_id
      ? {
          orgId: photo.org_id,
          animalId: photo.animal_id,
          photoId: photo.id,
        }
      : undefined,
  )
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
  input: {
    orgId: string
    animalId: string
    blob: Blob
    captureSource: 'camera' | 'gallery'
    /** Only for online, in-app camera captures — never set for offline/gallery. */
    captureToken?: string
  },
): Promise<PhotoRecord> {
  const compressed = await compressImage(input.blob)
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await storeLocalPhoto(id, compressed)
  await db.execute(
    `INSERT INTO photos (id, org_id, animal_id, r2_key, local_only, upload_state, capture_source, verified, created_at)
     VALUES (?, ?, ?, NULL, 1, 'pending', ?, 0, ?)`,
    [id, input.orgId, input.animalId, input.captureSource, created_at],
  )

  if (input.captureSource === 'camera' && input.captureToken) {
    rememberCaptureToken(id, input.captureToken)
  }

  return {
    id,
    org_id: input.orgId,
    animal_id: input.animalId,
    r2_key: null,
    local_only: 1,
    upload_state: 'pending',
    capture_source: input.captureSource,
    verified: 0,
    created_at,
  }
}

export async function countPendingPhotos(
  db: SanctuaryDb,
  orgId: string,
  animalId?: string,
): Promise<number> {
  // Only count uploads this device can finish (local Cache blob present).
  // Rows synced from another device without a blob must not keep a stuck badge.
  const rows = animalId
    ? await db.getAll<{ id: string; r2_key: string | null }>(
        `SELECT id, r2_key FROM photos
         WHERE org_id = ? AND animal_id = ? AND upload_state IN ('pending', 'failed')`,
        [orgId, animalId],
      )
    : await db.getAll<{ id: string; r2_key: string | null }>(
        `SELECT id, r2_key FROM photos
         WHERE org_id = ? AND upload_state IN ('pending', 'failed')`,
        [orgId],
      )

  let n = 0
  for (const row of rows) {
    if (row.r2_key) {
      await db.execute(
        `UPDATE photos SET upload_state = 'uploaded', local_only = 0 WHERE id = ?`,
        [row.id],
      )
      continue
    }
    if (await getLocalPhoto(row.id)) n += 1
  }
  return n
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

/** Reset rows left mid-upload (tab close / race) so they can retry. */
export async function recoverStaleUploadingPhotos(
  db: SanctuaryDb,
): Promise<number> {
  const stale = await db.getAll<{ id: string; r2_key: string | null }>(
    `SELECT id, r2_key FROM photos WHERE upload_state = 'uploading'`,
  )
  let recovered = 0
  for (const row of stale) {
    if (row.r2_key) {
      await db.execute(
        `UPDATE photos SET upload_state = 'uploaded', local_only = 0 WHERE id = ?`,
        [row.id],
      )
    } else {
      await db.execute(`UPDATE photos SET upload_state = 'pending' WHERE id = ?`, [
        row.id,
      ])
    }
    recovered += 1
  }
  return recovered
}

let photoQueueRunning: Promise<{ uploaded: number; failed: number }> | null =
  null

export async function processPhotoQueue(
  db: SanctuaryDb,
): Promise<{ uploaded: number; failed: number }> {
  if (photoQueueRunning) return photoQueueRunning

  photoQueueRunning = (async () => {
    await recoverStaleUploadingPhotos(db)
    await purgeOrphanedPendingPhotos(db)
    const { requestSignedUpload } = await import('@/shared/lib/r2/upload')
    const pending = await db.getAll<PhotoRecord>(
      `SELECT * FROM photos WHERE upload_state IN ('pending', 'failed') ORDER BY created_at ASC LIMIT 10`,
    )

    let uploaded = 0
    let failed = 0

    for (const photo of pending) {
      try {
        const blob = await getLocalPhoto(photo.id)
        if (!blob) {
          // Captured on another device (or local cache cleared). Never mark
          // failed here — that device owns the upload. If sync already brought
          // an R2 key, reconcile to uploaded so the UI can show the remote URL.
          if (photo.r2_key) {
            await db.execute(
              `UPDATE photos SET upload_state = 'uploaded', local_only = 0 WHERE id = ?`,
              [photo.id],
            )
            uploaded += 1
          }
          continue
        }
        await db.execute(
          `UPDATE photos SET upload_state = 'uploading' WHERE id = ?`,
          [photo.id],
        )
        const key = `${photo.org_id}/${photo.animal_id}/${photo.id}.jpg`
        const captureToken = pendingCaptureTokens.get(photo.id)
        const { uploadUrl, publicUrl } = await requestSignedUpload(
          key,
          captureToken ? { captureToken, photoId: photo.id } : undefined,
        )
        // Token is single-use server-side once signed — drop so retries don't
        // resend an already-consumed token.
        pendingCaptureTokens.delete(photo.id)
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
        // Server may already have set verified via capture-session; mirror that
        // locally so the capturing device shows the badge without waiting on sync.
        if (captureToken) {
          await db.execute(
            `UPDATE photos SET r2_key = ?, local_only = 0, upload_state = 'uploaded', verified = 1 WHERE id = ?`,
            [publicUrl || key, photo.id],
          )
        } else {
          await db.execute(
            `UPDATE photos SET r2_key = ?, local_only = 0, upload_state = 'uploaded' WHERE id = ?`,
            [publicUrl || key, photo.id],
          )
        }
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
  })()

  try {
    return await photoQueueRunning
  } finally {
    photoQueueRunning = null
  }
}
