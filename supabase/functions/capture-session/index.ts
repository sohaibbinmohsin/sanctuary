// Deno Supabase Edge Function — issues short-lived capture-session tokens for
// the in-app camera (verified photo attestation).
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY (verify caller JWT),
//          SUPABASE_SERVICE_ROLE_KEY (write photo_capture_sessions + rate buckets)
// Deploy with: supabase functions deploy capture-session
//
// Body: POST { animalId: string }
// - Auth: user JWT required; caller must be an `org_members` row for the
//   animal's org
// - 200: { sessionId, token, expiresAt } — token returned in plaintext ONCE;
//   only its sha256 hash is persisted (`photo_capture_sessions.token_hash`)
// - 400: missing/invalid animalId; 401: no/invalid JWT; 403: not a member of
//   the animal's org (or animal not found); 429: rate limited + Retry-After
//
// Rate limits (stricter than public-shelter — this mints session secrets):
// - 10/min/user, 20/min/org, 30/min/IP

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { consumeRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const USER_LIMIT = 10
const ORG_LIMIT = 20
const IP_LIMIT = 30
const WINDOW_SECONDS = 60
const SESSION_TTL_SECONDS = 3 * 60

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

const unauthorized = () => jsonResponse({ error: 'Unauthorized' }, 401)
const rateLimited = (retryAfterSeconds: number) =>
  jsonResponse(
    { error: 'rate_limited' },
    429,
    { 'Retry-After': String(retryAfterSeconds) },
  )

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(message),
  )
  return toHex(digest)
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toHex(bytes.buffer)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return unauthorized()
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return unauthorized()
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const ip = clientIp(req)
    const ipCheck = await consumeRateLimit(admin, {
      bucketKey: `capture-session:ip:${ip}`,
      limit: IP_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    })
    if (!ipCheck.allowed) {
      return rateLimited(ipCheck.retryAfterSeconds)
    }

    const userCheck = await consumeRateLimit(admin, {
      bucketKey: `capture-session:user:${user.id}`,
      limit: USER_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    })
    if (!userCheck.allowed) {
      return rateLimited(userCheck.retryAfterSeconds)
    }

    const { data: membership } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!membership?.org_id) {
      return jsonResponse({ error: 'No org membership' }, 403)
    }

    const orgCheck = await consumeRateLimit(admin, {
      bucketKey: `capture-session:org:${membership.org_id}`,
      limit: ORG_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    })
    if (!orgCheck.allowed) {
      return rateLimited(orgCheck.retryAfterSeconds)
    }

    let body: { animalId?: string }
    try {
      body = (await req.json()) as { animalId?: string }
    } catch {
      return jsonResponse({ error: 'Invalid body' }, 400)
    }

    const animalId = body.animalId?.trim()
    if (!animalId) {
      return jsonResponse({ error: 'animalId is required' }, 400)
    }

    const { data: animal, error: animalError } = await admin
      .from('animals')
      .select('id, org_id')
      .eq('id', animalId)
      .maybeSingle()

    if (animalError) throw animalError
    if (!animal || animal.org_id !== membership.org_id) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const token = randomToken()
    const tokenHash = await sha256Hex(token)
    const now = Date.now()
    const expiresAt = new Date(now + SESSION_TTL_SECONDS * 1000).toISOString()

    const { data: session, error: insertError } = await admin
      .from('photo_capture_sessions')
      .insert({
        org_id: membership.org_id,
        animal_id: animal.id,
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return jsonResponse(
      { sessionId: session.id, token, expiresAt },
      200,
    )
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
