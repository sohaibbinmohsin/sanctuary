import type { PublicShelterDto } from '@/shared/lib/public/visibility'

export type FetchPublicShelterResult =
  | { ok: true; data: PublicShelterDto }
  | { ok: false; status: number; retryAfterSeconds?: number }

/** Prefer publishable key (new Supabase naming); fall back to legacy anon key. */
function anonKey(): string {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ''
  )
}

export async function fetchPublicShelter(
  slug: string,
): Promise<FetchPublicShelterResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const key = anonKey()
  if (!supabaseUrl || !key) {
    return { ok: false, status: 500 }
  }

  let res: Response
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/public-shelter`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug }),
    })
  } catch {
    return { ok: false, status: 0 }
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After')
    const retryAfterSeconds = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : undefined
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : undefined,
    }
  }

  if (!res.ok) {
    return { ok: false, status: res.status }
  }

  const data = (await res.json()) as PublicShelterDto
  return { ok: true, data }
}
