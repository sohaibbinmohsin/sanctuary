import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { hasAppUpdate, readRemoteBuildVersion } from '@/shared/lib/pwa/version'

/**
 * Triggers service worker activation and reloads the window only after
 * the new service worker has taken control (controllerchange event).
 *
 * If the service worker is currently installing, it waits for installation.
 * If the service worker is stuck or offline, a safety timeout triggers cache
 * cleanup of Workbox precaches, unregisters the service worker, and reloads.
 */
export async function forceServiceWorkerUpdateAndReload(
  registration?: ServiceWorkerRegistration,
  timeoutMs = 6000,
  reload: () => void = () => window.location.reload(),
): Promise<void> {
  let reloaded = false
  const reloadOnce = () => {
    if (reloaded) return
    reloaded = true
    try {
      reload()
    } catch {
      // jsdom or unsupported navigation environments
    }
  }

  // Safety fallback: if anything hangs or fails to activate in timeoutMs,
  // clear workbox precaches, unregister SW, and reload.
  const fallbackTimer = setTimeout(async () => {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys()
        await Promise.all(
          keys
            .filter((k) => k.includes('workbox') || k.includes('precache'))
            .map((k) => caches.delete(k)),
        )
      }
      if (registration) {
        await registration.unregister()
      }
    } catch {
      // Ignore cleanup errors, proceed to reload
    } finally {
      reloadOnce()
    }
  }, timeoutMs)

  const swSupported =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator

  if (swSupported) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      clearTimeout(fallbackTimer)
      reloadOnce()
    })
  }

  try {
    let reg = registration
    if (!reg && swSupported) {
      reg = await navigator.serviceWorker.getRegistration()
    }

    if (!reg) {
      clearTimeout(fallbackTimer)
      reloadOnce()
      return
    }

    const sendSkipWaiting = (worker: ServiceWorker | null | undefined) => {
      if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' })
      }
    }

    // 1. If already waiting, tell it to skip waiting immediately
    if (reg.waiting) {
      sendSkipWaiting(reg.waiting)
      return
    }

    // 2. If currently installing, wait until it finishes installing
    if (reg.installing) {
      const installingWorker = reg.installing
      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          sendSkipWaiting(installingWorker)
        } else if (installingWorker.state === 'activated') {
          clearTimeout(fallbackTimer)
          reloadOnce()
        }
      })
      return
    }

    // 3. Otherwise, listen for new updates and trigger an update check
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          sendSkipWaiting(newWorker)
        } else if (newWorker.state === 'activated') {
          clearTimeout(fallbackTimer)
          reloadOnce()
        }
      })
    })

    await reg.update()
    if (reg.waiting) {
      sendSkipWaiting(reg.waiting)
    }
  } catch {
    // If update fails (e.g. offline), let fallback timer handle reload
  }
}

export function PwaUpdateBanner() {
  const [versionUpdate, setVersionUpdate] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  )

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration
    },
  })

  useEffect(() => {
    let cancelled = false

    async function check() {
      const remote = await readRemoteBuildVersion()
      if (cancelled) return
      if (hasAppUpdate(remote)) {
        setVersionUpdate(true)
        void registrationRef.current?.update()
      }
    }

    void check()

    function onVisible() {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => void check(), 5 * 60 * 1000)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  const hasUpdate = needRefresh || versionUpdate
  if (!hasUpdate) return null

  async function onRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      if (needRefresh) {
        void updateServiceWorker(false)
      }
      await forceServiceWorkerUpdateAndReload(registrationRef.current)
    } catch {
      window.location.reload()
    }
  }

  return (
    <button
      type="button"
      className="sync-banner sync-banner--update"
      disabled={refreshing}
      onClick={() => void onRefresh()}
    >
      {refreshing ? 'Updating…' : 'Refresh to update'}
    </button>
  )
}
