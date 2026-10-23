import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '@/app/router'
import * as useCurrentMemberModule from '@/shared/hooks/useCurrentMember'

vi.mock('@/shared/hooks/useDb', () => ({
  useDb: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    getOptional: vi.fn().mockResolvedValue(null),
  }),
}))
vi.mock('@/features/uploads/hooks/useMediaUploadRunner', () => ({ useMediaUploadRunner: () => {} }))
vi.mock('@/features/uploads/hooks/usePendingMedia', () => ({ usePendingMedia: () => ({ items: [] }) }))
vi.mock('@/shared/ui/ConfirmDialog', () => ({
  useConfirm: () => vi.fn(),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('AppShell Module Navigation', () => {
  it('shows only enabled modules in navigation', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Hotline Org',
        orgInitials: 'HO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['reports', 'animals']),
        hasModule: (m) => m === 'reports' || m === 'animals',
      },
    })

    render(
      <MemoryRouter initialEntries={['/animals']}>
        <AppShell />
      </MemoryRouter>,
    )

    // Reports and Animals should exist
    expect(screen.getAllByText('Animals').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0)

    // Ledger and Checklist should NOT be rendered in nav
    expect(screen.queryByText('Ledger')).toBeNull()
    expect(screen.queryByText('Checklist')).toBeNull()
  })

  it('redirects to first available enabled module when visiting a disabled route', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Hotline Org',
        orgInitials: 'HO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['reports']),
        hasModule: (m) => m === 'reports',
      },
    })

    render(
      <MemoryRouter initialEntries={['/ledger']}>
        <AppShell />
      </MemoryRouter>,
    )

    // Ledger is disabled and should redirect to reports
    expect(screen.queryByText('Ledger')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument()
  })

  it('does not render bottom navbar and instead renders mobile drawer trigger on primary screens', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Full Org',
        orgInitials: 'FO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['reports', 'animals', 'ledger', 'checklist']),
        hasModule: () => true,
      },
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>,
    )

    // Bottom navbar should be completely absent
    expect(container.querySelector('.app-nav')).toBeNull()

    // Mobile drawer trigger should be present on primary screens
    const trigger = container.querySelector('.mobile-drawer-trigger')
    expect(trigger).not.toBeNull()
    expect(trigger).toHaveAttribute('aria-label', 'Open navigation menu')

    // Sidebar has backdrop and is initially closed
    const sidebar = container.querySelector('.app-sidebar')
    expect(sidebar).not.toHaveClass('app-sidebar--mobile-open')
  })

  it('does not render mobile-drawer-trigger on secondary screens with back buttons', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Shelter Org',
        orgInitials: 'SO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['reports', 'animals']),
        hasModule: (m) => m === 'reports' || m === 'animals',
      },
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/reports/new']}>
        <AppShell />
      </MemoryRouter>,
    )

    // On secondary screen /reports/new (which has a back button), trigger is not shown
    expect(container.querySelector('.mobile-drawer-trigger')).toBeNull()
  })

  it('opens mobile drawer when trigger clicked and closes when nav item or backdrop is tapped', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Shelter Org',
        orgInitials: 'SO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['reports', 'animals']),
        hasModule: (m) => m === 'reports' || m === 'animals',
      },
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/animals']}>
        <AppShell />
      </MemoryRouter>,
    )

    const trigger = container.querySelector('.mobile-drawer-trigger') as HTMLButtonElement
    expect(trigger).not.toBeNull()

    const sidebar = container.querySelector('.app-sidebar')
    expect(sidebar).not.toHaveClass('app-sidebar--mobile-open')

    // Click trigger to open
    fireEvent.click(trigger)
    expect(sidebar).toHaveClass('app-sidebar--mobile-open')

    // Click a nav link inside drawer to close
    const reportsLink = container.querySelector('.app-sidebar__nav a[href="/reports"]') as HTMLAnchorElement
    expect(reportsLink).not.toBeNull()
    fireEvent.click(reportsLink)
    expect(sidebar).not.toHaveClass('app-sidebar--mobile-open')
  })

  it('highlights only Settings when on /settings (and not Overview)', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Shelter Org',
        orgInitials: 'SO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['reports', 'animals']),
        hasModule: (m) => m === 'reports' || m === 'animals',
      },
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppShell />
      </MemoryRouter>,
    )

    const activeLinks = container.querySelectorAll('.app-sidebar__nav a.active')
    expect(activeLinks).toHaveLength(1)
    expect(activeLinks[0]).toHaveAttribute('href', '/settings')

    const dashboardLink = container.querySelector('.app-sidebar__nav a[href="/dashboard"]')
    expect(dashboardLink).not.toHaveClass('active')
  })
})
