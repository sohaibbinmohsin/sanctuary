import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import * as canTakeModule from '@/shared/hooks/useCanTakePhoto'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
  }),
}))

vi.mock('@/shared/hooks/useCurrentMember', () => ({
  useCurrentMember: () => ({
    member: { orgId: 'org-1', orgInitials: 'TS', orgName: 'Test' },
    loading: false,
  }),
}))

vi.mock('@/shared/hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    kind: 'synced',
    hasSynced: true,
    status: 'connected',
    pendingCount: 0,
    downloading: false,
    uploading: false,
    errorMessage: null,
  }),
}))

vi.mock('@powersync/react', () => ({
  useQuery: () => ({ data: [{ n: 1 }] }),
}))

describe('AnimalsListScreen "Add animal" button target', () => {
  it('links to /animals/camera on mobile devices with camera support', async () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(true)

    render(
      <MemoryRouter>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    const addButtons = await screen.findAllByRole('link', { name: /add animal/i })
    expect(addButtons[0]).toHaveAttribute('href', '/animals/camera')
  })

  it('links to /animals/new on desktop browsers without camera support', async () => {
    vi.spyOn(canTakeModule, 'useCanTakePhoto').mockReturnValue(false)

    render(
      <MemoryRouter>
        <AnimalsListScreen />
      </MemoryRouter>,
    )

    const addButtons = await screen.findAllByRole('link', { name: /add animal/i })
    expect(addButtons[0]).toHaveAttribute('href', '/animals/new')
  })
})
