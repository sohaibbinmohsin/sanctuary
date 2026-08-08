// Deno Supabase Edge Function — signed R2 PUT URLs + server-side DELETE
// Secrets: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_BASE_URL
// Deploy with: supabase functions deploy r2-sign
//
// Body: { key: string, action?: 'upload' | 'delete' }
// - upload (default): returns { uploadUrl, publicUrl } for browser PUT
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
    }
    const key = body.key?.replace(/^\/+/, '')
    if (!key || !key.startsWith(`${membership.org_id}/`)) {
      return new Response(JSON.stringify({ error: 'Invalid key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
