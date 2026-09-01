import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ConfirmProvider } from '@/shared/ui/ConfirmDialog'
import { SetupWaitingScreen } from '@/features/onboarding/screens/SetupWaitingScreen'
import { OnboardingScreen } from '@/features/onboarding/screens/OnboardingScreen'
import { AppShell } from '@/app/router'
import * as useCurrentMemberModule from '@/shared/hooks/useCurrentMember'
import * as useDbModule from '@/shared/hooks/useDb'
import * as onboardingDomainModule from '@/features/onboarding/domain/onboarding'

vi.mock('@/shared/hooks/useCurrentMember')
vi.mock('@/shared/hooks/useDb')
vi.mock('@/features/uploads/hooks/useMediaUploadRunner', () => ({
  useMediaUploadRunner: vi.fn(),
}))
vi.mock('@/features/uploads/hooks/usePendingMedia', () => ({
  usePendingMedia: vi.fn(() => ({ items: [] })),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockDb = {
  getAll: vi.fn(async () => []),
  getOptional: vi.fn(async () => null),
  execute: vi.fn(async () => {}),
  writeTransaction: vi.fn(async (fn: any) => fn(mockDb)),
} as any

describe('SetupWaitingScreen', () => {
  it('displays message for staff when setup is incomplete', () => {
    const onSignOut = vi.fn()
    render(<SetupWaitingScreen onSignOut={onSignOut} />)
    expect(
      screen.getByText(/currently being set up by an administrator/i),
    ).toBeInTheDocument()
    const signOutBtn = screen.getByRole('button', { name: /Sign out/i })
    expect(signOutBtn).toBeInTheDocument()
    fireEvent.click(signOutBtn)
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingScreen', () => {
  const mockMember: useCurrentMemberModule.CurrentMember = {
    id: 'mem-1',
    orgId: 'org-1',
    userId: 'usr-1',
    role: 'admin',
    orgName: 'Hope Animal Rescue',
    orgInitials: 'HAR',
    orgLogoR2Key: null,
    publicEnabled: false,
    publicSlug: null,
    setupCompleted: false,
    currency: 'PKR',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentMemberModule.useCurrentMember).mockReturnValue({
      member: mockMember,
      loading: false,
    })
    vi.mocked(useDbModule.useDb).mockReturnValue(mockDb)
  })

  it('renders multi-step wizard starting at Step 1 and completes flow', async () => {
    const commitSpy = vi
      .spyOn(onboardingDomainModule, 'commitOnboarding')
      .mockResolvedValue()

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <OnboardingScreen />
      </MemoryRouter>,
    )

    // Brand header
    expect(screen.getByText('Sanctuary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign out/i })).toBeInTheDocument()

    // Step 1: Identity
    expect(screen.getByRole('heading', { name: /Shelter identity/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hope Animal Rescue')).toBeInTheDocument()

    // Move to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue to animal statuses/i }))

    // Step 2: Statuses
    expect(screen.getByRole('heading', { name: /Animal statuses/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Intake')).toBeInTheDocument()

    // Move to Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continue to ledger categories/i }))

    // Step 3: Ledger
    expect(screen.getByRole('heading', { name: /Ledger categories/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Donation')).toBeInTheDocument()

    // Finish setup
    const finishBtn = screen.getByRole('button', { name: /Finish setup/i })
    fireEvent.click(finishBtn)

    await waitFor(() => {
      expect(commitSpy).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          orgId: 'org-1',
          name: 'Hope Animal Rescue',
          initials: 'HAR',
        }),
      )
      expect(mockNavigate).toHaveBeenCalledWith('/animals', { replace: true })
    })
  })

  it('displays error on Step 3 if commit fails', async () => {
    vi.spyOn(onboardingDomainModule, 'commitOnboarding').mockRejectedValue(
      new Error('Failed to save settings to database'),
    )

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <OnboardingScreen />
      </MemoryRouter>,
    )

    // Step 1 -> Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continue to animal statuses/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to ledger categories/i }))

    // Finish
    fireEvent.click(screen.getByRole('button', { name: /Finish setup/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to save settings to database')).toBeInTheDocument()
    })
  })
})

describe('AppShell Route Guarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useDbModule.useDb).mockReturnValue(mockDb)
  })

  it('shows splash screen while member is loading', () => {
    vi.mocked(useCurrentMemberModule.useCurrentMember).mockReturnValue({
      member: null,
      loading: true,
    })

    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/animals']}>
          <AppShell />
        </MemoryRouter>
      </ConfirmProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Sanctuary' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Sidebar')).not.toBeInTheDocument()
  })

  it('routes incomplete setup admin to OnboardingScreen', () => {
    vi.mocked(useCurrentMemberModule.useCurrentMember).mockReturnValue({
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'usr-1',
        role: 'admin',
        orgName: 'New Sanctuary',
        orgInitials: 'NS',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: false,
        currency: 'PKR',
      },
      loading: false,
    })

    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/animals']}>
          <AppShell />
        </MemoryRouter>
      </ConfirmProvider>,
    )

    // Admin should see onboarding screen, not operational sidebar
    expect(screen.getByRole('heading', { name: /Shelter identity/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Sidebar')).not.toBeInTheDocument()
  })

  it('renders SetupWaitingScreen for non-admin staff when setup is incomplete', () => {
    vi.mocked(useCurrentMemberModule.useCurrentMember).mockReturnValue({
      member: {
        id: 'mem-2',
        orgId: 'org-1',
        userId: 'usr-2',
        role: 'staff',
        orgName: 'New Sanctuary',
        orgInitials: 'NS',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: false,
        currency: 'PKR',
      },
      loading: false,
    })

    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/animals']}>
          <AppShell />
        </MemoryRouter>
      </ConfirmProvider>,
    )

    expect(
      screen.getByText(/currently being set up by an administrator/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Sidebar')).not.toBeInTheDocument()
  })

  it('renders operational app shell when setupCompleted is true and disallows /onboarding', () => {
    vi.mocked(useCurrentMemberModule.useCurrentMember).mockReturnValue({
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'usr-1',
        role: 'admin',
        orgName: 'Active Sanctuary',
        orgInitials: 'AS',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
      },
      loading: false,
    })

    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/onboarding']}>
          <AppShell />
        </MemoryRouter>
      </ConfirmProvider>,
    )

    // Should render sidebar and redirect /onboarding to /animals
    expect(screen.getByLabelText('Sidebar')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Shelter identity/i })).not.toBeInTheDocument()
  })
})
