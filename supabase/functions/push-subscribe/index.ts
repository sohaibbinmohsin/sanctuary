// Deno Supabase Edge Function — upsert Web Push subscriptions for checklist reminders.
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY (verify caller JWT),
//          SUPABASE_SERVICE_ROLE_KEY (upsert push_subscriptions)
// Deploy with: supabase functions deploy push-subscribe
//
// Body: POST { endpoint: string, keys: { p256dh: string, auth: string } }
//   (PushSubscription.toJSON() shape; flat { endpoint, p256dh, auth } also accepted)
// - Auth: user JWT required; caller must have an `org_members` row
// - 200: { ok: true }
// - 400: missing/invalid body; 401: no/invalid JWT; 403: no org membership

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const unauthorized = () => jsonResponse({ error: 'Unauthorized' }, 401)

type SubscribeBody = {
  endpoint?: string
  p256dh?: string
  auth?: string
  keys?: { p256dh?: string; auth?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
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

    const { data: membership } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!membership?.org_id) {
      return jsonResponse({ error: 'No org membership' }, 403)
    }

    let body: SubscribeBody
    try {
      body = (await req.json()) as SubscribeBody
    } catch {
      return jsonResponse({ error: 'Invalid body' }, 400)
    }

    const endpoint = body.endpoint?.trim()
    const p256dh = (body.keys?.p256dh ?? body.p256dh)?.trim()
    const auth = (body.keys?.auth ?? body.auth)?.trim()

    if (!endpoint || !p256dh || !auth) {
      return jsonResponse(
        { error: 'endpoint, keys.p256dh, and keys.auth are required' },
        400,
      )
    }

    const { error: upsertError } = await admin.from('push_subscriptions').upsert(
      {
        org_id: membership.org_id,
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'user_id,endpoint' },
    )

    if (upsertError) throw upsertError

    return jsonResponse({ ok: true }, 200)
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
