import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

/**
 * Durable fixed-window rate limiter backed by `edge_rate_buckets`.
 * Pass a service-role Supabase client — the table has no client RLS policies.
 *
 * Env default limits (see each Edge Function's env vars):
 * - `public-shelter`: 60/min/IP, 120/min/slug
 * - `capture-session`: 10/min/user, 20/min/org, 30/min/IP
 */
export async function consumeRateLimit(
  admin: SupabaseClient,
  opts: { bucketKey: string; limit: number; windowSeconds: number },
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { bucketKey, limit, windowSeconds } = opts
  const now = new Date()

  const { data: row, error: readError } = await admin
    .from('edge_rate_buckets')
    .select('window_start, hit_count')
    .eq('bucket_key', bucketKey)
    .maybeSingle()

  if (readError) throw readError

  const windowExpired =
    !row ||
    (now.getTime() - new Date(row.window_start).getTime()) / 1000 >=
      windowSeconds

  if (windowExpired) {
    const { error: writeError } = await admin.from('edge_rate_buckets').upsert({
      bucket_key: bucketKey,
      window_start: now.toISOString(),
      hit_count: 1,
    })
    if (writeError) throw writeError
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (row.hit_count < limit) {
    const { error: writeError } = await admin
      .from('edge_rate_buckets')
      .update({ hit_count: row.hit_count + 1 })
      .eq('bucket_key', bucketKey)
    if (writeError) throw writeError
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const elapsed =
    (now.getTime() - new Date(row.window_start).getTime()) / 1000
  const retryAfterSeconds = Math.ceil(windowSeconds - elapsed)

  return { allowed: false, retryAfterSeconds }
}
