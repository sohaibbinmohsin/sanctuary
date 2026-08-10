export type CaptureSession = {
  sessionId: string
  token: string
  expiresAt: string
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

/**
 * Requests a short-lived (~3 min) capture-session token from the
 * `capture-session` Edge Function for the in-app verified-photo camera.
 * The plaintext token is only ever returned once — only its hash is stored.
 */
export async function requestCaptureSession({
  animalId,
}: {
  animalId: string
}): Promise<CaptureSession> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set')
  }
  const token = await authToken()

  const res = await fetch(`${supabaseUrl}/functions/v1/capture-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ animalId }),
  })

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After')
    const retryAfterSeconds = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : undefined
    throw new Error(
      `Too many capture requests${retryAfterSeconds ? ` — retry in ${retryAfterSeconds}s` : ''}`,
    )
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(
      `Capture session request failed: ${res.status}${detail ? ` ${detail}` : ''}`,
    )
  }

  return (await res.json()) as CaptureSession
}
