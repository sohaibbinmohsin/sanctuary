/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  /** New Supabase dashboard name (preferred). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Legacy name; still accepted as fallback. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_POWERSYNC_URL: string
  readonly VITE_R2_PUBLIC_BASE_URL: string
  /** Fixed public site origin for donor links (e.g. https://sanctuary.themohsinproject.org). */
  readonly VITE_DOMAIN?: string
  readonly VITE_SUPPORT_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
