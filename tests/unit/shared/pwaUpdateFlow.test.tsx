import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PwaUpdateProvider } from '@/shared/lib/pwa/pwaUpdateContext'
import { PwaUpdateModal } from '@/shared/ui/PwaUpdateModal'
import { PwaUpdatePill } from '@/shared/ui/PwaUpdatePill'


// Mock useSyncStatus
let mockSyncStatus = {
  kind: 'synced' as const,
  errorMessage: null,
  hasSynced: true,
  downloading: false,
  uploading: false,
}

vi.mock('@/shared/hooks/useSyncStatus', () => ({
  useSyncStatus: () => mockSyncStatus,
}))

// Mock virtual:pwa-register/react
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

// Mock reload helper
const mockReloadHelper = vi.fn().mockResolvedValue(undefined)
vi.mock('@/shared/lib/pwa/reload', () => ({
  forceServiceWorkerUpdateAndReload: (...args: unknown[]) =>
    mockReloadHelper(...args),
}))

function TestApp({
  readVersion,
  onReload,
}: {
  readVersion: () => Promise<{ version: string; critical: boolean } | null>
  onReload?: () => void
}) {
  return (
    <MemoryRouter>
      <PwaUpdateProvider readVersion={readVersion} onReload={onReload}>
        <div data-testid="sidebar">
          <span>Sanctuary</span>
          <PwaUpdatePill />
        </div>
        <PwaUpdateModal />
      </PwaUpdateProvider>
    </MemoryRouter>
  )
}

describe('PwaUpdate flow & event-driven behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockSyncStatus = {
      kind: 'synced',
      errorMessage: null,
      hasSynced: true,
      downloading: false,
      uploading: false,
    }
  })

  it('does not display modal or pill when no update exists', async () => {
    const readVersion = vi.fn().mockResolvedValue(null)

    render(<TestApp readVersion={readVersion} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Update available')).toBeNull()
  })

  it('pops up modal when update is found, snoozes to pill on "Later", and reopens on pill click', async () => {
    // Current build is LOCAL_BUILD (empty or string), return remote differing version
    const readVersion = vi.fn().mockResolvedValue({
      version: 'different-build-123',
      critical: false,
    })

    render(<TestApp readVersion={readVersion} />)

    // Modal appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByText('Update Available')).toBeInTheDocument()
    expect(
      screen.getByText(/Your offline records and edits are completely safe/i),
    ).toBeInTheDocument()

    // While modal is open, pill in sidebar is not visible
    expect(screen.queryByText('Update available')).toBeNull()

    // Click "Later"
    const laterBtn = screen.getByRole('button', { name: 'Later' })
    fireEvent.click(laterBtn)

    // Modal should close
    expect(screen.queryByRole('dialog')).toBeNull()

    // Pill now appears in the sidebar
    const pill = screen.getByRole('button', { name: /Update available/i })
    expect(pill).toBeInTheDocument()

    // Clicking pill re-opens the exact same modal
    fireEvent.click(pill)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Update Available')).toBeInTheDocument()
  })

  it('enforces critical update: no "Later" button and cannot close modal', async () => {
    const readVersion = vi.fn().mockResolvedValue({
      version: 'critical-build-999',
      critical: true,
    })

    render(<TestApp readVersion={readVersion} />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText('Critical Update Required')).toBeInTheDocument()
    expect(
      screen.getByText(/This update contains critical security or system fixes/i),
    ).toBeInTheDocument()

    // "Later" button is NOT rendered
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull()

    // Pressing Escape does not close the dialog
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('waits for active offline uploads before triggering reload when updating', async () => {
    mockSyncStatus.uploading = true
    const readVersion = vi.fn().mockResolvedValue({
      version: 'new-version-456',
      critical: false,
    })
    const onReload = vi.fn()

    render(<TestApp readVersion={readVersion} onReload={onReload} />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const updateNowBtn = screen.getByRole('button', { name: 'Update now' })
    fireEvent.click(updateNowBtn)

    // Should indicate saving offline updates
    await waitFor(() => {
      expect(screen.getByText('Finishing saving your updates…')).toBeInTheDocument()
    })

    // Simulate upload finishing
    act(() => {
      mockSyncStatus.uploading = false
    })

    // Reload helper is called
    await waitFor(() => {
      expect(mockReloadHelper).toHaveBeenCalled()
    })
  })

  it('triggers update check on visibilitychange without setting 5-minute setInterval', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const readVersion = vi.fn().mockResolvedValue(null)

    render(<TestApp readVersion={readVersion} />)

    // Wait for check on mount to complete
    await waitFor(() => {
      expect(readVersion).toHaveBeenCalledTimes(1)
    })

    // Confirm NO 5-minute setInterval (300000ms) was registered
    const fiveMinCalls = setIntervalSpy.mock.calls.filter(
      (call) => call[1] === 300000,
    )
    expect(fiveMinCalls.length).toBe(0)

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    fireEvent(document, new Event('visibilitychange'))

    await waitFor(() => {
      expect(readVersion).toHaveBeenCalledTimes(2)
    })

    // Simulate online event
    fireEvent(window, new Event('online'))
    await waitFor(() => {
      expect(readVersion).toHaveBeenCalledTimes(3)
    })
  })
})

