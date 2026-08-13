// Deno Supabase Edge Function — evening / morning checklist Web Push reminders.
//
// Cron (pilot Pakistan UTC+5 = Asia/Karachi):
//   Evening 18:00 local → schedule at 13:00 UTC  (?slot=evening)
//   Morning 08:00 local → schedule at 03:00 UTC  (?slot=morning)
// Schedule two Supabase cron / pg_cron (or external) jobs hitting this function
// with the matching `slot` query param and CHECKLIST_CRON_SECRET header.
//
// Secrets:
//   CHECKLIST_CRON_SECRET — shared secret (Authorization: Bearer … or
//                           x-checklist-cron-secret)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… or https:…)
//
// Deploy: supabase functions deploy checklist-reminders
//
// GET|POST ?slot=evening|morning
// - 200: { ok: true, slot, orgs, sent, failed, skippedOrgs }
// - 401: missing/invalid cron secret
// - 400: bad slot

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

/** Pilot timezone for “today” / missed-day calendar logic. */
const PILOT_TZ = 'Asia/Karachi'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-checklist-cron-secret',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const unauthorized = () => jsonResponse({ error: 'Unauthorized' }, 401)

// --- Copy (keep in sync with src/shared/lib/checklist/reminderCopy.ts) ---

function eveningReminderTitle(): string {
  return 'Checklist incomplete'
}

function eveningReminderBody(uncheckedCount: number): string {
  return uncheckedCount === 1
    ? '1 animal on today’s checklist is still unchecked.'
    : `${uncheckedCount} animals on today’s checklist are still unchecked.`
}

function morningReminderTitle(): string {
  return 'Checklist overdue'
}

function morningReminderBody(missedCount: number): string {
  return missedCount === 1
    ? '1 animal still has a missed checklist day.'
    : `${missedCount} animals still have missed checklist days.`
}

// --- Pilot calendar helpers (mirror missedStreak.ts with fixed TZ) ---

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

function dateInPilotTz(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PILOT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function dateStringToDay(date: string): number {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new Error(`Invalid local date: ${date}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const value = Date.UTC(year, month - 1, day)
  return Math.floor(value / DAY_MS)
}

function missedDayStreak(input: {
  addedAtIso: string
  checkDates: string[]
  today: string
}): number {
  const addedAt = new Date(input.addedAtIso)
  if (Number.isNaN(addedAt.getTime())) {
    throw new Error(`Invalid added_at timestamp: ${input.addedAtIso}`)
  }
  const addedDay = dateStringToDay(dateInPilotTz(addedAt))
  const yesterday = dateStringToDay(input.today) - 1
  const checkedDays = new Set(input.checkDates.map(dateStringToDay))

  let streak = 0
  for (let day = yesterday; day >= addedDay && !checkedDays.has(day); day -= 1) {
    streak += 1
  }
  return streak
}

type Slot = 'evening' | 'morning'

type ChecklistItemRow = {
  org_id: string
  animal_id: string
  added_at: string
}

type CheckRow = {
  animal_id: string
  check_date: string
}

type PushSub = {
  endpoint: string
  p256dh: string
  auth: string
}

function cronSecretFromRequest(req: Request): string | null {
  const custom = req.headers.get('x-checklist-cron-secret')?.trim()
  if (custom) return custom
  const auth = req.headers.get('authorization')
  if (!auth) return null
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim())
  return match?.[1]?.trim() ?? null
}

function parseSlot(req: Request): Slot | null {
  const url = new URL(req.url)
  const slot = url.searchParams.get('slot')?.trim().toLowerCase()
  if (slot === 'evening' || slot === 'morning') return slot
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const expected = Deno.env.get('CHECKLIST_CRON_SECRET')?.trim()
  const provided = cronSecretFromRequest(req)
  if (!expected || !provided || provided !== expected) {
    return unauthorized()
  }

  const slot = parseSlot(req)
  if (!slot) {
    return jsonResponse(
      { error: 'Query param slot=evening|morning is required' },
      400,
    )
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')?.trim()
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')?.trim()
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')?.trim()
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return jsonResponse(
      { error: 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT required' },
      500,
    )
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const today = dateInPilotTz(new Date())

  const { data: items, error: itemsError } = await admin
    .from('checklist_items')
    .select('org_id, animal_id, added_at')
  if (itemsError) {
    console.error(itemsError)
    return jsonResponse({ error: 'Failed to load checklist_items' }, 500)
  }

  const byOrg = new Map<string, ChecklistItemRow[]>()
  for (const row of (items ?? []) as ChecklistItemRow[]) {
    const list = byOrg.get(row.org_id) ?? []
    list.push(row)
    byOrg.set(row.org_id, list)
  }

  let sent = 0
  let failed = 0
  let skippedOrgs = 0
  const orgIds = [...byOrg.keys()]

  for (const orgId of orgIds) {
    const orgItems = byOrg.get(orgId) ?? []
    const animalIds = [...new Set(orgItems.map((i) => i.animal_id))]
    if (animalIds.length === 0) {
      skippedOrgs += 1
      continue
    }

    const { data: animals, error: animalsError } = await admin
      .from('animals')
      .select('id')
      .eq('org_id', orgId)
      .eq('archived', false)
      .in('id', animalIds)
    if (animalsError) {
      console.error(animalsError)
      failed += 1
      continue
    }
    const activeIds = new Set((animals ?? []).map((a: { id: string }) => a.id))
    const activeItems = orgItems.filter((i) => activeIds.has(i.animal_id))
    if (activeItems.length === 0) {
      skippedOrgs += 1
      continue
    }

    const { data: checks, error: checksError } = await admin
      .from('checklist_checks')
      .select('animal_id, check_date')
      .eq('org_id', orgId)
      .in(
        'animal_id',
        activeItems.map((i) => i.animal_id),
      )
    if (checksError) {
      console.error(checksError)
      failed += 1
      continue
    }

    const checkDatesByAnimal = new Map<string, string[]>()
    for (const check of (checks ?? []) as CheckRow[]) {
      const dates = checkDatesByAnimal.get(check.animal_id) ?? []
      dates.push(check.check_date)
      checkDatesByAnimal.set(check.animal_id, dates)
    }

    let targetCount = 0
    if (slot === 'evening') {
      targetCount = activeItems.filter((item) => {
        const dates = checkDatesByAnimal.get(item.animal_id) ?? []
        return !dates.includes(today)
      }).length
    } else {
      targetCount = activeItems.filter((item) => {
        const dates = checkDatesByAnimal.get(item.animal_id) ?? []
        return (
          missedDayStreak({
            addedAtIso: item.added_at,
            checkDates: dates,
            today,
          }) >= 1
        )
      }).length
    }

    if (targetCount === 0) {
      skippedOrgs += 1
      continue
    }

    const title =
      slot === 'evening' ? eveningReminderTitle() : morningReminderTitle()
    const body =
      slot === 'evening'
        ? eveningReminderBody(targetCount)
        : morningReminderBody(targetCount)

    const payload = JSON.stringify({
      title,
      body,
      url: '/checklist',
      data: { url: '/checklist' },
    })

    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('org_id', orgId)
    if (subsError) {
      console.error(subsError)
      failed += 1
      continue
    }

    const subscriptions = (subs ?? []) as PushSub[]
    if (subscriptions.length === 0) {
      skippedOrgs += 1
      continue
    }

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 12 },
        )
        sent += 1
      } catch (err) {
        // Fail soft per subscription — continue the org batch.
        console.error('Web Push failed for subscription', sub.endpoint, err)
        failed += 1
      }
    }
  }

  return jsonResponse(
    {
      ok: true,
      slot,
      today,
      timeZone: PILOT_TZ,
      orgs: orgIds.length,
      sent,
      failed,
      skippedOrgs,
    },
    200,
  )
})
