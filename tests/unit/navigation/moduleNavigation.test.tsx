import { render, screen } from '@testing-library/react'
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

  it('omits Settings from mobile bottomNav when all 4 modules are active so nav has 5 buttons', () => {
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

    // The bottom nav (.app-nav) should have exactly 5 links: Reports, Animals, Ledger, Checklist, Overview
    const bottomNav = container.querySelector('.app-nav')
    expect(bottomNav).not.toBeNull()
    const bottomNavLinks = bottomNav!.querySelectorAll('a')
    expect(bottomNavLinks.length).toBe(5)

    const labels = Array.from(bottomNavLinks).map((a) => a.textContent?.trim())
    expect(labels).toEqual(['Reports', 'Animals', 'Ledger', 'Checklist', 'Overview'])
  })
})
