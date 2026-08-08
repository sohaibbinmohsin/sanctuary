export async function compressImage(
  blob: Blob,
  maxEdge = 1600,
  quality = 0.7,
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

  const type = 'image/jpeg'
  const compressed = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality)
  })
  return compressed ?? blob
}

export type SignedUpload = {
  uploadUrl: string
  publicUrl: string
}

async function authToken(): Promise<string> {
  const { supabase } = await import('@/shared/lib/supabase')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('Not authenticated')
  }
  return token
}

async function callR2Sign(
  body: Record<string, unknown>,
): Promise<Response> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set')
  }
  const token = await authToken()
  return fetch(`${supabaseUrl}/functions/v1/r2-sign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export async function requestSignedUpload(key: string): Promise<SignedUpload> {
  const res = await callR2Sign({ key, action: 'upload' })
  if (!res.ok) {
    throw new Error(`Signed URL request failed: ${res.status}`)
  }
  return (await res.json()) as SignedUpload
}

/** Ask the edge function to delete the object in R2 (server-side). */
export async function requestR2Delete(key: string): Promise<void> {
  const res = await callR2Sign({ key, action: 'delete' })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(
      `Could not delete photo from storage: ${res.status}${detail ? ` ${detail}` : ''}`,
    )
  }
}

/**
 * Normalize stored `photos.r2_key` (public URL or object key) to the R2 object key.
 * Keys look like `{orgId}/{animalId}/{photoId}.jpg`.
 */
export function r2ObjectKey(
  r2Key: string | null | undefined,
  fallback?: { orgId: string; animalId: string; photoId: string },
): string | null {
  if (r2Key?.trim()) {
    const raw = r2Key.trim()
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const path = new URL(raw).pathname.replace(/^\/+/, '')
        if (path) return path
      } catch {
        // fall through
      }
    } else {
      return raw.replace(/^\/+/, '')
    }
  }
  if (fallback) {
    return `${fallback.orgId}/${fallback.animalId}/${fallback.photoId}.jpg`
  }
  return null
}

export function publicPhotoUrl(r2Key: string | null | undefined): string | null {
  if (!r2Key) return null
  if (r2Key.startsWith('http')) return r2Key
  const base = import.meta.env.VITE_R2_PUBLIC_BASE_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/${r2Key}`
}
