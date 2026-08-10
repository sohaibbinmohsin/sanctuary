import type { SanctuaryDb } from '@/shared/lib/db'
import {
  publicPhotoUrl,
  requestR2Delete,
  requestSignedUpload,
  r2ObjectKey,
} from '@/shared/lib/r2/upload'
import { isPlaygroundMode } from '@/features/playground/mode'

const LOGO_CACHE = 'sanctuary-partner-logo-v1'

export function partnerLogoObjectKey(orgId: string): string {
  return `${orgId}/branding/logo.png`
}

export function partnerLogoCacheUrl(orgId: string): string {
  return `/__local_partner_logo__/${orgId}`
}

async function logoStore(): Promise<Cache> {
  return caches.open(LOGO_CACHE)
}

/** Resize logo for share cards; keep PNG so transparency survives. */
export async function compressPartnerLogo(
  blob: Blob,
  maxEdge = 800,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return blob
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const compressed = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
  return compressed ?? blob
}

export async function getLocalPartnerLogo(
  orgId: string,
): Promise<Blob | null> {
  const cache = await logoStore()
  const res = await cache.match(partnerLogoCacheUrl(orgId))
  if (!res) return null
  return res.blob()
}

async function storeLocalPartnerLogo(
  orgId: string,
  blob: Blob,
): Promise<void> {
  const cache = await logoStore()
  await cache.put(
    partnerLogoCacheUrl(orgId),
    new Response(blob, {
      headers: { 'Content-Type': blob.type || 'image/png' },
    }),
  )
}

async function deleteLocalPartnerLogo(orgId: string): Promise<void> {
  const cache = await logoStore()
  await cache.delete(partnerLogoCacheUrl(orgId))
}

/**
 * Prefer local cache (works offline + html-to-image), else fetch public R2
 * and cache for next time.
 */
export async function ensurePartnerLogoCached(
  orgId: string,
  logoR2Key: string | null | undefined,
): Promise<Blob | null> {
  const local = await getLocalPartnerLogo(orgId)
  if (local) return local

  const url = publicPhotoUrl(logoR2Key)
  if (!url || logoR2Key === 'local') return null
  if (!navigator.onLine) return null

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    await storeLocalPartnerLogo(orgId, blob)
    return blob
  } catch {
    return null
  }
}

/** Upload (or replace) partner logo to R2 and sync logo_r2_key on the org. */
export async function setPartnerLogo(
  db: SanctuaryDb,
  orgId: string,
  blob: Blob,
): Promise<string> {
  const prepared = await compressPartnerLogo(blob)
  await storeLocalPartnerLogo(orgId, prepared)

  if (isPlaygroundMode()) {
    await db.execute(
      `UPDATE organizations SET logo_r2_key = ? WHERE id = ?`,
      ['local', orgId],
    )
    return 'local'
  }

  if (!navigator.onLine) {
    throw new Error('Connect to the internet to save the partner logo.')
  }

  const key = partnerLogoObjectKey(orgId)
  const { uploadUrl, publicUrl } = await requestSignedUpload(key)
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: prepared,
  })
  if (!put.ok) {
    const detail = (await put.text().catch(() => '')).slice(0, 200)
    throw new Error(
      `Logo upload failed: ${put.status}${detail ? ` ${detail}` : ''}`,
    )
  }

  const stored = publicUrl || key
  await db.execute(`UPDATE organizations SET logo_r2_key = ? WHERE id = ?`, [
    stored,
    orgId,
  ])
  return stored
}

export async function clearPartnerLogo(
  db: SanctuaryDb,
  orgId: string,
  logoR2Key?: string | null,
): Promise<void> {
  const existing = await db.getOptional<{ logo_r2_key: string | null }>(
    `SELECT logo_r2_key FROM organizations WHERE id = ?`,
    [orgId],
  )
  const keyHint = logoR2Key ?? existing?.logo_r2_key

  if (!isPlaygroundMode() && keyHint && keyHint !== 'local') {
    if (!navigator.onLine) {
      throw new Error('Connect to the internet to remove the partner logo.')
    }
    const key = r2ObjectKey(keyHint) ?? partnerLogoObjectKey(orgId)
    await requestR2Delete(key)
  }

  await deleteLocalPartnerLogo(orgId)
  await db.execute(`UPDATE organizations SET logo_r2_key = NULL WHERE id = ?`, [
    orgId,
  ])
}
