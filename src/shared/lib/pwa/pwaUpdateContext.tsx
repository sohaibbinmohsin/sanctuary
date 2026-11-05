import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  hasAppUpdate,
  readRemoteBuildVersion,
  type RemoteBuildInfo,
} from '@/shared/lib/pwa/version'
import { forceServiceWorkerUpdateAndReload } from '@/shared/lib/pwa/reload'
import { useSyncStatus } from '@/shared/hooks/useSyncStatus'

export type PwaUpdateContextType = {
  hasUpdate: boolean
  isCritical: boolean
  modalOpen: boolean
  snoozed: boolean
  refreshing: boolean
  statusMessage: string | null
  openModal: () => void
  closeModal: () => void
  applyUpdate: () => Promise<void>
}

const PwaUpdateContext = createContext<PwaUpdateContextType | null>(null)

export function usePwaUpdate(): PwaUpdateContextType {
  const ctx = useContext(PwaUpdateContext)
  if (!ctx) {
    return {
      hasUpdate: false,
      isCritical: false,
      modalOpen: false,
      snoozed: false,
      refreshing: false,
      statusMessage: null,
      openModal: () => {},
      closeModal: () => {},
      applyUpdate: async () => {},
    }
  }
  return ctx
}

export type PwaUpdateProviderProps = {
  children: ReactNode
  onReload?: () => void
  readVersion?: () => Promise<RemoteBuildInfo | null>
}

export function PwaUpdateProvider({
  children,
  onReload,
  readVersion = readRemoteBuildVersion,
}: PwaUpdateProviderProps) {
  const [remoteInfo, setRemoteInfo] = useState<RemoteBuildInfo | null>(null)
  const [swNeedRefresh, setSwNeedRefresh] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [snoozed, setSnoozed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const checkingRef = useRef(false)
  const location = useLocation()
  const syncStatus = useSyncStatus()
  const syncStatusRef = useRef(syncStatus)
  syncStatusRef.current = syncStatus

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onNeedReload() {
      // Do not auto-reload on service worker controlling event.
      // Reload is applied when user explicitly clicks "Update now" in modal or pill.
    },
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration
    },
  })

  useEffect(() => {
    if (needRefresh) {
      setSwNeedRefresh(true)
      setModalOpen(true)
    }
  }, [needRefresh])

  const check = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    try {
      const remote = await readVersion()
      if (remote && hasAppUpdate(remote)) {
        setRemoteInfo(remote)
        setModalOpen(true)
        void registrationRef.current?.update()
      }
    } catch {
      // offline or version check error - safe to ignore
    } finally {
      checkingRef.current = false
    }
  }, [readVersion])

  // Event-driven update checks (no aggressive 5-minute interval):
  // 1. Initial mount
  useEffect(() => {
    void check()
  }, [check])

  // 2. On route navigation (e.g. user moves between animals, reports, ledger)
  useEffect(() => {
    void check()
  }, [location.pathname, check])

  // 3. Tab visibility / window focus (e.g. user switches back to Sanctuary tab or unlocks phone)
  // 4. Online reconnection (e.g. phone connects back to cellular/Wi-Fi)
  useEffect(() => {
    const handleVisibleOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void check()
      }
    }
    const handleOnline = () => {
      void check()
    }

    document.addEventListener('visibilitychange', handleVisibleOrFocus)
    window.addEventListener('focus', handleVisibleOrFocus)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibleOrFocus)
      window.removeEventListener('focus', handleVisibleOrFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [check])

  const hasUpdate = Boolean(swNeedRefresh || (remoteInfo && hasAppUpdate(remoteInfo)))
  const isCritical = Boolean(remoteInfo?.critical)

  const openModal = useCallback(() => {
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    if (isCritical) return // Cannot dismiss critical updates
    setModalOpen(false)
    setSnoozed(true)
  }, [isCritical])

  const applyUpdate = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)

    // Data safety check: If PowerSync is actively uploading local changes,
    // wait a moment for the in-flight upload to complete cleanly.
    if (syncStatusRef.current?.uploading) {
      setStatusMessage('Finishing saving your updates…')
      const start = Date.now()
      while (syncStatusRef.current?.uploading && Date.now() - start < 3000) {
        await new Promise((r) => setTimeout(r, 200))
      }
      setStatusMessage(null)
    }
    try {
      if (swNeedRefresh) {
        void updateServiceWorker(false)
      }
      await forceServiceWorkerUpdateAndReload(
        registrationRef.current,
        6000,
        onReload,
      )
    } catch {
      if (onReload) {
        onReload()
      } else {
        window.location.reload()
      }
    }
  }, [refreshing, swNeedRefresh, updateServiceWorker, onReload])

  const value: PwaUpdateContextType = {
    hasUpdate,
    isCritical,
    modalOpen: hasUpdate && modalOpen,
    snoozed,
    refreshing,
    statusMessage,
    openModal,
    closeModal,
    applyUpdate,
  }

  return (
    <PwaUpdateContext.Provider value={value}>
      {children}
    </PwaUpdateContext.Provider>
  )
}
