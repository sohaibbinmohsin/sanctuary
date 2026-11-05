import { render, screen, fireEvent, within } from '@testing-library/react'
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

  it('allows direct path access even when module is not in sidebar navigation', () => {
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

    // Ledger is accessible directly via route
    expect(screen.getByRole('heading', { level: 1, name: 'Ledger' })).toBeInTheDocument()
    // But Ledger does not appear in the sidebar navigation items
    const nav = screen.getByRole('navigation')
    expect(within(nav).queryByText('Ledger')).toBeNull()
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

  it('renders sidebar structure with scrollable nav container, fixed header and footer, without line break tags', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Full Shelter Org',
        orgInitials: 'FSO',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set<import('@/shared/domain/modules').AppModuleId>([
          'reports',
          'animals',
          'checklist',
          'ledger',
        ]),
        hasModule: () => true,
      },
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/reports']}>
        <AppShell />
      </MemoryRouter>,
    )

    const sidebar = container.querySelector('.app-sidebar')
    expect(sidebar).not.toBeNull()

    const header = sidebar?.querySelector('.app-sidebar__header')
    expect(header).not.toBeNull()

    const nav = sidebar?.querySelector('.app-sidebar__nav')
    expect(nav).not.toBeNull()

    const footer = sidebar?.querySelector('.app-sidebar__footer')
    expect(footer).not.toBeNull()

    // Ensure no line break tags (<br>) are added anywhere in the sidebar
    expect(sidebar?.querySelectorAll('br')).toHaveLength(0)

    // Ensure footer copyright and attribution are rendered cleanly
    const copyright = footer?.querySelector('.app-sidebar__copyright')
    expect(copyright).not.toBeNull()
    const mohsin = footer?.querySelector('.app-sidebar__mohsin')
    expect(mohsin).not.toBeNull()
  })
})
