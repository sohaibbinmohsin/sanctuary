import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { hasAppUpdate, readRemoteBuildVersion } from '@/shared/lib/pwa/version'

export function PwaUpdateBanner() {
  const [available, setAvailable] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  )
  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration
    },
  })

  useEffect(() => {
    let cancelled = false

    async function check() {
      const remote = await readRemoteBuildVersion()
      if (cancelled || !hasAppUpdate(remote)) return
      setAvailable(true)
      void registrationRef.current?.update()
    }

    void check()

    function onVisible() {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!available) return null

  async function onRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await registrationRef.current?.update()
      await updateServiceWorker(true)
      window.location.reload()
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
      {refreshing ? 'Refreshing…' : 'Refresh to update'}
    </button>
  )
}
