// Deno Supabase Edge Function — public (no-auth) read of an org's public shelter page.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role used only after slug
// resolves to an opted-in org), R2_PUBLIC_BASE_URL
// Deploy with: supabase functions deploy public-shelter
//
// Body (GET query string `?slug=` or POST JSON `{ slug: string }`)
// - 200: PublicShelterDto (see src/shared/lib/public/visibility.ts)
// - 404: { error: 'not_found' } — identical response whether the org is missing,
//   disabled, or the slug is malformed, so scanners can't distinguish cases.
// - 429: { error: 'rate_limited' } + Retry-After header
//
// SQL filters mirror src/shared/lib/public/visibility.ts (buildPublicShelterDto) —
// keep both in sync if visibility rules change:
// - Org: public_enabled = true AND public_slug = $slug
// - Animals: archived = false AND joined status.counts_as_in_care = true
// - Treatments (care): hide_from_public = false; if none are arrived/intake,
//   synthesize Arrived from animals.intake_date (notes stay private)
// - Ledger: hide_from_public = false; is_anonymous rows never select attachments
// - Photos: verified flag passed through; URL built from R2_PUBLIC_BASE_URL + r2_key
// - animals.notes is never selected — private field, excluded from the DTO entirely

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { consumeRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const IP_LIMIT = 60
const IP_WINDOW_SECONDS = 60
const SLUG_LIMIT = 120
const SLUG_WINDOW_SECONDS = 60

function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

const notFound = () => jsonResponse({ error: 'not_found' }, 404)

/**
 * Rate-limit bucket key. Uses the rightmost X-Forwarded-For entry — the one
 * appended by the closest proxy — because the leftmost entries are
 * client-supplied and trivially spoofed to dodge the IP bucket.
 */
function clientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp

  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const entries = forwarded
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const rightmost = entries[entries.length - 1]
    if (rightmost) return rightmost
  }

  return 'unknown'
}

function publicPhotoUrl(base: string, r2Key: string | null): string | null {
  if (!r2Key) return null
  if (r2Key.startsWith('http')) return r2Key
  if (!base) return null
  return `${base.replace(/\/$/, '')}/${r2Key.replace(/^\/+/, '')}`
}

async function readSlug(req: Request): Promise<string | null> {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    return url.searchParams.get('slug')
  }
  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as { slug?: string }
      return body.slug ?? null
    } catch {
      return null
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawSlug = await readSlug(req)
    const slug = rawSlug?.trim().toLowerCase()
    if (!slug) {
      return notFound()
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const ip = clientIp(req)
    const ipCheck = await consumeRateLimit(admin, {
      bucketKey: `public-shelter:ip:${ip}`,
      limit: IP_LIMIT,
      windowSeconds: IP_WINDOW_SECONDS,
    })
    if (!ipCheck.allowed) {
      return jsonResponse(
        { error: 'rate_limited' },
        429,
        { 'Retry-After': String(ipCheck.retryAfterSeconds) },
      )
    }

    const slugCheck = await consumeRateLimit(admin, {
      bucketKey: `public-shelter:slug:${slug}`,
      limit: SLUG_LIMIT,
      windowSeconds: SLUG_WINDOW_SECONDS,
    })
    if (!slugCheck.allowed) {
      return jsonResponse(
        { error: 'rate_limited' },
        429,
        { 'Retry-After': String(slugCheck.retryAfterSeconds) },
      )
    }

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('id, name, public_slug, logo_r2_key')
      .eq('public_enabled', true)
      .eq('public_slug', slug)
      .maybeSingle()

    if (orgError) throw orgError
    if (!org) {
      return notFound()
    }

    const [{ data: animalsRaw, error: animalsError }, { data: ledgerRaw, error: ledgerError }] =
      await Promise.all([
        admin
          .from('animals')
          .select(
            `
              id, shelter_code, name, species, sex, markings, archived, intake_date,
              status:animal_statuses!animals_status_id_fkey ( label, counts_as_in_care ),
              photos ( id, r2_key, verified ),
              treatments ( id, treated_at, treatment_type, notes, hide_from_public )
            `,
          )
          .eq('org_id', org.id)
          .eq('archived', false),
        admin
          .from('ledger_entries')
          .select('id, direction, amount_cents, entry_date, notes, animal_id, is_anonymous, hide_from_public, category:ledger_categories!ledger_entries_category_id_fkey ( label )')
          .eq('org_id', org.id)
          .eq('hide_from_public', false),
      ])

    if (animalsError) throw animalsError
    if (ledgerError) throw ledgerError

    const r2PublicBase = Deno.env.get('R2_PUBLIC_BASE_URL') ?? ''

    type AnimalRow = {
      id: string
      shelter_code: string
      name: string | null
      species: string | null
      sex: string | null
      markings: string | null
      archived: boolean
      intake_date: string | null
      status: { label: string; counts_as_in_care: boolean } | null
      photos: { id: string; r2_key: string | null; verified: boolean }[] | null
      treatments:
        | {
            id: string
            treated_at: string
            treatment_type: string
            notes: string | null
            hide_from_public: boolean
          }[]
        | null
    }

    const animals = ((animalsRaw ?? []) as unknown as AnimalRow[])
      .filter((row) => !row.archived && row.status?.counts_as_in_care === true)
      .map((row) => {
        const care = (row.treatments ?? [])
          .filter((treatment) => treatment.hide_from_public !== true)
          .map((treatment) => ({
            id: treatment.id,
            treatedAt: treatment.treated_at,
            treatmentType: treatment.treatment_type,
            notes: treatment.notes,
          }))

        const hasArrival = care.some(
          (entry) =>
            entry.treatmentType === 'arrived' || entry.treatmentType === 'intake',
        )
        if (!hasArrival && row.intake_date) {
          care.push({
            id: `${row.id}-arrived`,
            treatedAt: row.intake_date.includes('T')
              ? row.intake_date
              : `${row.intake_date}T12:00:00.000Z`,
            treatmentType: 'arrived',
            notes: null,
          })
        }

        care.sort((a, b) => b.treatedAt.localeCompare(a.treatedAt))

        return {
          id: row.id,
          shelterCode: row.shelter_code,
          name: row.name,
          species: row.species,
          sex: row.sex,
          markings: row.markings,
          statusLabel: row.status?.label ?? '',
          photos: (row.photos ?? [])
            .map((photo) => ({
              id: photo.id,
              url: publicPhotoUrl(r2PublicBase, photo.r2_key),
              verified: photo.verified,
            }))
            .filter((photo): photo is { id: string; url: string; verified: boolean } =>
              Boolean(photo.url),
            ),
          care,
        }
      })

    type LedgerRow = {
      id: string
      direction: 'in' | 'out'
      amount_cents: number
      entry_date: string
      notes: string | null
      animal_id: string | null
      is_anonymous: boolean
      hide_from_public: boolean
      category: { label: string } | null
    }

    const nonAnonymousLedgerIds = ((ledgerRaw ?? []) as unknown as LedgerRow[])
      .filter((row) => !row.is_anonymous)
      .map((row) => row.id)

    const attachmentsByEntry = new Map<string, string[]>()
    if (nonAnonymousLedgerIds.length > 0) {
      const { data: attachmentsRaw, error: attachmentsError } = await admin
        .from('ledger_attachments')
        .select('ledger_entry_id, r2_key')
        .in('ledger_entry_id', nonAnonymousLedgerIds)

      if (attachmentsError) throw attachmentsError

      for (const attachment of (attachmentsRaw ?? []) as {
        ledger_entry_id: string
        r2_key: string | null
      }[]) {
        const url = publicPhotoUrl(r2PublicBase, attachment.r2_key)
        if (!url) continue
        const existing = attachmentsByEntry.get(attachment.ledger_entry_id) ?? []
        existing.push(url)
        attachmentsByEntry.set(attachment.ledger_entry_id, existing)
      }
    }

    const ledger = ((ledgerRaw ?? []) as unknown as LedgerRow[]).map((row) => ({
      id: row.id,
      direction: row.direction,
      amountCents: row.amount_cents,
      entryDate: row.entry_date,
      categoryLabel: row.category?.label ?? '',
      // Free-text notes on anonymous entries often carry the donor's name —
      // drop them entirely rather than leak them in the JSON payload.
      notes: row.is_anonymous ? null : row.notes,
      animalId: row.animal_id,
      isAnonymous: row.is_anonymous,
      attachmentUrls: row.is_anonymous ? [] : attachmentsByEntry.get(row.id) ?? [],
    }))

    const orgRow = org as {
      id: string
      name: string
      public_slug: string
      logo_r2_key: string | null
    }

    const dto = {
      orgName: orgRow.name,
      logoUrl: publicPhotoUrl(r2PublicBase, orgRow.logo_r2_key),
      slug: orgRow.public_slug,
      animals,
      ledger,
    }

    return jsonResponse(dto, 200)
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
