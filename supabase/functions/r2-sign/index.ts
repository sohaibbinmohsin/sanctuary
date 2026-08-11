// Deno Supabase Edge Function — signed R2 PUT URLs + server-side DELETE
// Secrets: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_BASE_URL,
//          SUPABASE_SERVICE_ROLE_KEY (verify capture-session tokens + set photos.verified)
// Deploy with: supabase functions deploy r2-sign
//
// Body: { key: string, action?: 'upload' | 'delete', captureToken?: string, photoId?: string }
// - upload (default): returns { uploadUrl, publicUrl } for browser PUT (requires R2 CORS)
//   - When captureToken + photoId are present and match an unused, unexpired
//     `photo_capture_sessions` row scoped to the key's org/animal, the session is
//     marked used and `photos.verified` is set true via the service role. An
//     invalid/expired/missing token never blocks the upload — it just stays unverified.
//   - The client-sent `verified` value (if any) is always ignored.
// - delete: deletes the object in R2 from the edge function (no browser CORS needed)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

async function hmacSha256(
  key: BufferSource,
  message: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

async function getSignatureKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  // Pass Uint8Array directly — `.buffer` can include extra bytes and break SigV4.
  const kDate = await hmacSha256(
    new TextEncoder().encode('AWS4' + secret),
    dateStamp,
  )
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
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

/** Account S3 API origin only — strip accidental /bucket paths. */
function normalizeEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '')
  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed
  }
}

async function signedR2Url(opts: {
  method: 'PUT' | 'DELETE'
  key: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
}): Promise<string> {
  const region = 'auto'
  const service = 's3'
  const host = new URL(opts.endpoint).host
  const now = new Date()
  const amzDate =
    now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const expires = 300
  // Sign only host — do not send Content-Type from the browser PUT.
  const signedHeaders = 'host'
  const canonicalUri = `/${opts.bucket}/${opts.key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${opts.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': signedHeaders,
  })

  const canonicalQuerystring = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQuerystring,
    `host:${host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = await getSignatureKey(
    opts.secretAccessKey,
    dateStamp,
    region,
    service,
  )
  const signature = toHex(await hmacSha256(signingKey, stringToSign))
  return `${opts.endpoint}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`
}

/**
 * Best-effort: mark a matching capture-session token used and flip
 * `photos.verified` true via the service role. Any failure (missing/expired/
 * already-used/mismatched token, missing service role key, DB error) is
 * swallowed — an invalid token must never fail or block the upload.
 */
async function tryBindCaptureSession(opts: {
  supabaseUrl: string
  serviceRoleKey: string
  orgId: string
  animalId: string
  photoId: string
  token: string
}): Promise<void> {
  if (!opts.supabaseUrl || !opts.serviceRoleKey) return
  try {
    const admin = createClient(opts.supabaseUrl, opts.serviceRoleKey)
    const tokenHash = await sha256Hex(opts.token)
    const nowIso = new Date().toISOString()

    const { data: session } = await admin
      .from('photo_capture_sessions')
      .select('id')
      .eq('token_hash', tokenHash)
      .eq('org_id', opts.orgId)
      .eq('animal_id', opts.animalId)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .maybeSingle()

    if (!session?.id) return

    const { error: updateSessionError } = await admin
      .from('photo_capture_sessions')
      .update({ used_at: nowIso, photo_id: opts.photoId })
      .eq('id', session.id)
      .eq('org_id', opts.orgId)
      .eq('animal_id', opts.animalId)
      .is('used_at', null)
    if (updateSessionError) return

    // Scope by org/animal too — a client-supplied photoId must never flip
    // `verified` on a photo outside the caller's org or the key's animal.
    await admin
      .from('photos')
      .update({ verified: true })
      .eq('id', opts.photoId)
      .eq('org_id', opts.orgId)
      .eq('animal_id', opts.animalId)
  } catch (err) {
    console.error('Capture-session binding failed (non-fatal):', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!membership?.org_id) {
      return new Response(JSON.stringify({ error: 'No org membership' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as {
      key?: string
      action?: 'upload' | 'delete'
      captureToken?: string
      photoId?: string
    }
    const key = body.key?.replace(/^\/+/, '')
    if (!key || !key.startsWith(`${membership.org_id}/`)) {
      return new Response(JSON.stringify({ error: 'Invalid key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Key layout is `{orgId}/{animalId}/{photoId}.jpg` — pull animalId for
    // capture-session scoping without trusting the client's photoId alone.
    const keyAnimalId = key.split('/')[1]

    const action = body.action === 'delete' ? 'delete' : 'upload'

    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID') ?? ''
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? ''
    const bucket = Deno.env.get('R2_BUCKET') ?? ''
    const endpoint = normalizeEndpoint(Deno.env.get('R2_ENDPOINT') ?? '')
    const publicBase = (Deno.env.get('R2_PUBLIC_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    )

    if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
      return new Response(JSON.stringify({ error: 'R2 not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete') {
      const deleteUrl = await signedR2Url({
        method: 'DELETE',
        key,
        accessKeyId,
        secretAccessKey,
        bucket,
        endpoint,
      })
      const del = await fetch(deleteUrl, { method: 'DELETE' })
      // 404/NoSuchKey: already gone — treat as success
      if (!del.ok && del.status !== 404) {
        const detail = (await del.text().catch(() => '')).slice(0, 200)
        return new Response(
          JSON.stringify({
            error: `R2 delete failed: ${del.status}${detail ? ` ${detail}` : ''}`,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
      return new Response(JSON.stringify({ ok: true, key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uploadUrl = await signedR2Url({
      method: 'PUT',
      key,
      accessKeyId,
      secretAccessKey,
      bucket,
      endpoint,
    })
    const publicUrl = publicBase ? `${publicBase}/${key}` : key

    // Never trust a client-sent `verified` flag — only a matched, valid
    // capture-session token can flip it, and only via the service role.
    const captureToken = body.captureToken?.trim()
    const photoId = body.photoId?.trim()
    if (captureToken && photoId && keyAnimalId) {
      await tryBindCaptureSession({
        supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        orgId: membership.org_id,
        animalId: keyAnimalId,
        photoId,
        token: captureToken,
      })
    }

    return new Response(JSON.stringify({ uploadUrl, publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
