/**
 * Web Push subscribe helper for checklist reminders.
 * Uses the Vite PWA service worker (`navigator.serviceWorker.ready`) +
 * `push-subscribe` Edge Function. Soft-fails when VAPID / Push is unavailable.
 */

export type PushPermissionState =
  | NotificationPermission
  | 'unsupported'
  | 'no-vapid'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export function vapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (typeof key !== 'string' || !key.trim()) return null
  return key.trim()
}

export function getPushPermissionState(): PushPermissionState {
  if (
    typeof window === 'undefined' ||
    typeof Notification === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return 'unsupported'
  }
  if (!vapidPublicKey()) return 'no-vapid'
  return Notification.permission
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
 * Request notification permission, subscribe via PushManager, and POST the
 * subscription to `push-subscribe`. Returns the resulting permission state.
 * Soft-fails (returns without throwing) when VAPID / Push is unavailable.
 */
export async function enableChecklistPush(): Promise<PushPermissionState> {
  const state = getPushPermissionState()
  if (state === 'unsupported' || state === 'no-vapid') {
    return state
  }
  if (state === 'denied') {
    return 'denied'
  }

  const vapid = vapidPublicKey()
  if (!vapid) return 'no-vapid'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
  })

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set')
  }
  const token = await authToken()
  const json = subscription.toJSON()

  const res = await fetch(`${supabaseUrl}/functions/v1/push-subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  })

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(
      `Push subscribe failed: ${res.status}${detail ? ` ${detail}` : ''}`,
    )
  }

  return 'granted'
}
