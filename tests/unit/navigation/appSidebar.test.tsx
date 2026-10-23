import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '@/app/router'
import * as useCurrentMemberModule from '@/shared/hooks/useCurrentMember'
import * as useOrgLogoModule from '@/shared/hooks/useOrgLogo'

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

describe('AppShell Desktop Sidebar', () => {
  it('displays shelter name as main brand without subheadline and shows sanctuary logo when no org logo', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Paws & Claws Rescue',
        orgInitials: 'PC',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['animals']),
        hasModule: (m) => m === 'animals',
      },
    })
    vi.spyOn(useOrgLogoModule, 'useOrgLogo').mockReturnValue(null)

    const { container } = render(
      <MemoryRouter initialEntries={['/animals']}>
        <AppShell />
      </MemoryRouter>,
    )

    const brandEl = container.querySelector('.app-sidebar__brand')
    expect(brandEl).toHaveTextContent('Paws & Claws Rescue')
    expect(container.querySelector('.app-sidebar__org')).toBeNull()

    const logoEl = container.querySelector('.app-sidebar__logo')
    expect(logoEl).not.toBeNull()
    expect(logoEl?.tagName.toLowerCase()).toBe('svg')
    expect(logoEl?.querySelector('rect')).toHaveAttribute('rx', '100')

    // Sidebar footer
    const currentYear = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(`Sanctuary © ${currentYear}`))).toBeInTheDocument()
    expect(screen.getByText('A free software by The Mohsin Project')).toBeInTheDocument()
    const mohsinImg = container.querySelector('.app-sidebar__mohsin img') as HTMLImageElement
    expect(mohsinImg).not.toBeNull()
    expect(mohsinImg.src).toContain('/mohsin-project-logo.svg')
  })

  it('displays custom org logo in rounded square when available', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-2',
        orgId: 'org-2',
        userId: 'user-2',
        role: 'admin',
        orgName: 'Bark Haven',
        orgInitials: 'BH',
        orgLogoR2Key: 'logos/org-2.png',
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['animals']),
        hasModule: (m) => m === 'animals',
      },
    })
    vi.spyOn(useOrgLogoModule, 'useOrgLogo').mockReturnValue('blob:http://localhost/custom-logo-blob')

    const { container } = render(
      <MemoryRouter initialEntries={['/animals']}>
        <AppShell />
      </MemoryRouter>,
    )

    const logoImg = container.querySelector('.app-sidebar__logo') as HTMLImageElement
    expect(logoImg).not.toBeNull()
    expect(logoImg.src).toContain('blob:http://localhost/custom-logo-blob')
  })

  it('renders drawer toggle button and collapses/expands sidebar on click', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Paws & Claws',
        orgInitials: 'PC',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['animals']),
        hasModule: (m) => m === 'animals',
      },
    })
    vi.spyOn(useOrgLogoModule, 'useOrgLogo').mockReturnValue(null)

    const { container } = render(
      <MemoryRouter initialEntries={['/animals']}>
        <AppShell />
      </MemoryRouter>,
    )

    const toggleBtn = container.querySelector('.sidebar-toggle-btn') as HTMLButtonElement
    expect(toggleBtn).not.toBeNull()

    const sidebar = container.querySelector('.app-sidebar')
    expect(sidebar).not.toHaveClass('app-sidebar--collapsed')

    // Click toggle button to collapse
    fireEvent.click(toggleBtn)
    expect(sidebar).toHaveClass('app-sidebar--collapsed')

    // Collapsed hover icon is rendered inside logo button
    const hoverIcon = container.querySelector('.collapsed-hover-icon')
    expect(hoverIcon).not.toBeNull()

    // Click logo button to expand
    const logoBtn = container.querySelector('.sidebar-logo-btn') as HTMLButtonElement
    fireEvent.click(logoBtn)
    expect(sidebar).not.toHaveClass('app-sidebar--collapsed')
  })

  it('does not uncollapse sidebar when tapping nav items in collapsed mode and displays mohsin project logo in footer', () => {
    vi.spyOn(useCurrentMemberModule, 'useCurrentMember').mockReturnValue({
      loading: false,
      member: {
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'admin',
        orgName: 'Paws & Claws',
        orgInitials: 'PC',
        orgLogoR2Key: null,
        publicEnabled: false,
        publicSlug: null,
        setupCompleted: true,
        currency: 'PKR',
        enabledModules: new Set(['animals', 'reports']),
        hasModule: () => true,
      },
    })
    vi.spyOn(useOrgLogoModule, 'useOrgLogo').mockReturnValue(null)

    const { container } = render(
      <MemoryRouter initialEntries={['/animals']}>
        <AppShell />
      </MemoryRouter>,
    )

    const toggleBtn = container.querySelector('.sidebar-toggle-btn') as HTMLButtonElement
    const sidebar = container.querySelector('.app-sidebar')

    // Collapse sidebar
    fireEvent.click(toggleBtn)
    expect(sidebar).toHaveClass('app-sidebar--collapsed')

    // Footer still contains the Mohsin Project logo link
    const mohsinLink = container.querySelector('.app-sidebar__footer .app-sidebar__mohsin')
    expect(mohsinLink).not.toBeNull()
    const mohsinImg = mohsinLink?.querySelector('img')
    expect(mohsinImg).not.toBeNull()
    expect(mohsinImg?.getAttribute('src')).toBe('/mohsin-project-logo.svg')

    // Click a nav link inside collapsed sidebar
    const reportsLink = container.querySelector('.app-sidebar__nav a[href="/reports"]') as HTMLAnchorElement
    expect(reportsLink).not.toBeNull()
    fireEvent.click(reportsLink)

    // Sidebar should remain collapsed!
    expect(sidebar).toHaveClass('app-sidebar--collapsed')
  })
})
