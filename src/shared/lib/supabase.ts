import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
/** Prefer publishable key (new Supabase naming); fall back to legacy anon key. */
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''

export const supabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabasePublishableKey)

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export function getSupportEmail(): string {
  return (
    import.meta.env.VITE_SUPPORT_EMAIL || 'support@themohsinproject.org'
  )
}
