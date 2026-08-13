/**
 * Web Push subscribe helper for checklist reminders.
 * Uses the Vite PWA service worker (`navigator.serviceWorker.ready`) +
 * `push-subscribe` Edge Function. Soft-fails when VAPID / Push is unavailable.
 */

export type PushPermissionState =
  | NotificationPermission
  | 'unsupported'
  | 'no-vapid'

/** App-level reminder status (permission alone isn’t enough after turn-off). */
export type ChecklistPushStatus =
  | 'unsupported'
  | 'no-vapid'
  | 'denied'
  | 'off'
  | 'on'

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

async function waitForServiceWorker(
  timeoutMs = 10000,
): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing?.active) return existing

  // Ensure a registration is kicked off (virtual:pwa-register also does this).
  if (!existing) {
    try {
      await navigator.serviceWorker.register(
        import.meta.env.MODE === 'production' ? '/sw.js' : '/dev-sw.js?dev-sw',
      )
    } catch {
      // Fall through to ready / timeout messaging.
    }
  }

  const ready = navigator.serviceWorker.ready
  const timedOut = new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(
        new Error(
          'Service worker is still starting. Reload the page, then try again.',
        ),
      )
    }, timeoutMs)
  })
  return Promise.race([ready, timedOut])
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await waitForServiceWorker()
  return registration.pushManager.getSubscription()
}

export async function getChecklistPushStatus(): Promise<ChecklistPushStatus> {
  const permission = getPushPermissionState()
  if (
    permission === 'unsupported' ||
    permission === 'no-vapid' ||
    permission === 'denied'
  ) {
    return permission
  }
  if (permission === 'default') return 'off'
  try {
    const sub = await currentSubscription()
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

async function upsertSubscription(subscription: PushSubscription): Promise<void> {
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
}

async function deleteSubscription(endpoint: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set')
  }
  const token = await authToken()

  const res = await fetch(`${supabaseUrl}/functions/v1/push-subscribe`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint }),
  })

  if (!res.ok && res.status !== 404) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(
      `Push unsubscribe failed: ${res.status}${detail ? ` ${detail}` : ''}`,
    )
  }
}

/**
 * Request notification permission, subscribe via PushManager, and POST the
 * subscription to `push-subscribe`. Reuses an existing subscription when present.
 */
export async function enableChecklistPush(): Promise<ChecklistPushStatus> {
  const state = getPushPermissionState()
  if (state === 'unsupported' || state === 'no-vapid') {
    return state
  }
  if (state === 'denied') {
    return 'denied'
  }

  const vapid = vapidPublicKey()
  if (!vapid) return 'no-vapid'

  const permission =
    state === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'off'
  }

  const registration = await waitForServiceWorker()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    })
  }

  await upsertSubscription(subscription)
  return 'on'
}

/** Unsubscribe this device and remove the server row so reminders stop. */
export async function disableChecklistPush(): Promise<ChecklistPushStatus> {
  const state = getPushPermissionState()
  if (state === 'unsupported' || state === 'no-vapid') {
    return state
  }

  const registration = await waitForServiceWorker()
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    await deleteSubscription(endpoint)
  }

  return 'off'
}
