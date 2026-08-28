import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { forceServiceWorkerUpdateAndReload } from '@/shared/ui/PwaUpdateBanner'

describe('forceServiceWorkerUpdateAndReload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('sends SKIP_WAITING to waiting worker immediately', async () => {
    const postMessageMock = vi.fn()
    const reloadMock = vi.fn()
    const mockWaiting = {
      postMessage: postMessageMock,
    } as unknown as ServiceWorker

    const mockRegistration = {
      waiting: mockWaiting,
      installing: null,
      update: vi.fn(),
      unregister: vi.fn(),
    } as unknown as ServiceWorkerRegistration

    await forceServiceWorkerUpdateAndReload(mockRegistration, 5000, reloadMock)

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('waits for installing worker to transition to installed before sending SKIP_WAITING', async () => {
    const postMessageMock = vi.fn()
    const reloadMock = vi.fn()
    let stateChangeHandler: (() => void) | null = null

    const mockInstalling = {
      state: 'installing',
      postMessage: postMessageMock,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'statechange') {
          stateChangeHandler = handler
        }
      }),
    } as unknown as ServiceWorker

    const mockRegistration = {
      waiting: null,
      installing: mockInstalling,
      update: vi.fn(),
      unregister: vi.fn(),
    } as unknown as ServiceWorkerRegistration

    await forceServiceWorkerUpdateAndReload(mockRegistration, 5000, reloadMock)

    expect(postMessageMock).not.toHaveBeenCalled()
    expect(mockInstalling.addEventListener).toHaveBeenCalledWith(
      'statechange',
      expect.any(Function),
    )

    // Simulate state transition to 'installed'
    Object.defineProperty(mockInstalling, 'state', { value: 'installed' })
    if (typeof stateChangeHandler === 'function') {
      ;(stateChangeHandler as () => void)()
    }

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('triggers update() when neither waiting nor installing worker exists', async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined)
    const reloadMock = vi.fn()
    const mockRegistration = {
      waiting: null,
      installing: null,
      update: updateMock,
      addEventListener: vi.fn(),
      unregister: vi.fn(),
    } as unknown as ServiceWorkerRegistration

    await forceServiceWorkerUpdateAndReload(mockRegistration, 5000, reloadMock)

    expect(updateMock).toHaveBeenCalled()
  })

  it('triggers fallback unregister and cache cleanup on timeout', async () => {
    const unregisterMock = vi.fn().mockResolvedValue(true)
    const reloadMock = vi.fn()
    const mockRegistration = {
      waiting: null,
      installing: null,
      update: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      addEventListener: vi.fn(),
      unregister: unregisterMock,
    } as unknown as ServiceWorkerRegistration

    const deleteMock = vi.fn().mockResolvedValue(true)
    const keysMock = vi.fn().mockResolvedValue(['workbox-precache-v2', 'other-cache'])
    vi.stubGlobal('caches', {
      keys: keysMock,
      delete: deleteMock,
    })

    void forceServiceWorkerUpdateAndReload(mockRegistration, 3000, reloadMock)

    await vi.advanceTimersByTimeAsync(3500)

    expect(unregisterMock).toHaveBeenCalled()
    expect(deleteMock).toHaveBeenCalledWith('workbox-precache-v2')
    expect(deleteMock).not.toHaveBeenCalledWith('other-cache')
    expect(reloadMock).toHaveBeenCalled()
  })
})
