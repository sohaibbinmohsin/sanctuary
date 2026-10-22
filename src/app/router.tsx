import { useState, useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  Cat,
  CheckSquare,
  CloudArrowUp,
  CurrencyCircleDollar,
  ChartBar,
  GearSix,
  MegaphoneSimple,
} from '@phosphor-icons/react'
import type { AppModuleId } from '@/shared/domain/modules'
import { SyncBanner } from '@/shared/ui/SyncBanner'
import { PlaygroundBanner } from '@/features/playground/PlaygroundBanner'
import { isPlaygroundMode } from '@/features/playground/mode'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import { AnimalsFiltersScreen } from '@/features/animals/screens/AnimalsFiltersScreen'
import { AddToChecklistScreen } from '@/features/animals/screens/AddToChecklistScreen'
import { AnimalIntakeScreen } from '@/features/animals/screens/AnimalIntakeScreen'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'
import { LedgerScreen } from '@/features/ledger/screens/LedgerScreen'
import { LedgerEntryScreen } from '@/features/ledger/screens/LedgerEntryScreen'
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen'
import { ReportsListScreen } from '@/features/reports/screens/ReportsListScreen'
import { ReportIntakeScreen } from '@/features/reports/screens/ReportIntakeScreen'
import { ReportDetailScreen } from '@/features/reports/screens/ReportDetailScreen'
import { ChecklistScreen } from '@/features/checklist/screens/ChecklistScreen'
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen'
import { UploadsScreen } from '@/features/uploads/screens/UploadsScreen'
import { useOrgLogo } from '@/shared/hooks/useOrgLogo'
import { SanctuaryLogo } from '@/shared/ui/SanctuaryLogo'
import { SplashScreen } from '@/shared/ui/SplashScreen'
import { OnboardingScreen } from '@/features/onboarding/screens/OnboardingScreen'
import { SetupWaitingScreen } from '@/features/onboarding/screens/SetupWaitingScreen'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { useDb } from '@/shared/hooks/useDb'
import { useMediaUploadRunner } from '@/features/uploads/hooks/useMediaUploadRunner'
import { usePendingMedia } from '@/features/uploads/hooks/usePendingMedia'
import { PwaUpdateProvider, usePwaUpdate } from '@/shared/lib/pwa/pwaUpdateContext'
import { PwaUpdateModal } from '@/shared/ui/PwaUpdateModal'
import { PwaUpdatePill } from '@/shared/ui/PwaUpdatePill'


interface NavItemDef {
  to: string
  label: string
  icon: typeof Cat
  moduleId?: AppModuleId
}

const MODULE_NAV_DEFINITIONS: readonly (NavItemDef & { moduleId: AppModuleId })[] = [
  { moduleId: 'reports', to: '/reports', label: 'Reports', icon: MegaphoneSimple },
  { moduleId: 'animals', to: '/animals', label: 'Animals', icon: Cat },
  { moduleId: 'ledger', to: '/ledger', label: 'Ledger', icon: CurrencyCircleDollar },
  { moduleId: 'checklist', to: '/checklist', label: 'Checklist', icon: CheckSquare },
] as const

const BASE_SIDEBAR_NAV: readonly NavItemDef[] = [
  { to: '/dashboard', label: 'Overview', icon: ChartBar },
  { to: '/uploads', label: 'Uploads', icon: CloudArrowUp },
  { to: '/settings', label: 'Settings', icon: GearSix },
]

function getFallbackModuleRoute(hasModule?: (m: AppModuleId) => boolean): string {
  if (!hasModule) return '/reports'
  for (const item of MODULE_NAV_DEFINITIONS) {
    if (hasModule(item.moduleId)) {
      return item.to
    }
  }
  return '/dashboard'
}

function isPrimaryPath(pathname: string, primaryPaths: Set<string>): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return primaryPaths.has(normalized)
}

function NavItems({
  className,
  items,
  badges,
  onItemClick,
}: {
  className: string
  items: readonly NavItemDef[]
  badges?: Partial<Record<string, number>>
  onItemClick?: () => void
}) {
  return (
    <nav className={className} aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => {
        const count = badges?.[to] ?? 0

        return (
          <NavLink
            key={to}
            to={to}
            end={
              to === '/animals' || to === '/ledger' || to === '/reports'
                ? false
                : undefined
            }
            onClick={onItemClick}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            <Icon weight="duotone" aria-hidden />
            <span className="app-nav__label">{label}</span>
            {count > 0 ? (
              <span className="app-nav__badge" aria-label={`${count} waiting`}>
                {count > 99 ? '99+' : count}
              </span>
            ) : null}
          </NavLink>
        )
      })}
    </nav>
  )
}

function AppShellContent() {
  const db = useDb()
  const { member, loading } = useCurrentMember()
  const playground = isPlaygroundMode()
  const { pathname } = useLocation()
  const { hasUpdate, modalOpen } = usePwaUpdate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {

    if (typeof window !== 'undefined') {
      return localStorage.getItem('sanctuary_sidebar_collapsed') === 'true'
    }
    return false
  })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileDrawerOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileDrawerOpen])

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev: boolean) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('sanctuary_sidebar_collapsed', String(next))
      }
      return next
    })
  }

  useMediaUploadRunner(playground ? null : db)
  const { items: pendingUploads } = usePendingMedia(
    playground ? undefined : member?.orgId,
  )
  const uploadBadge = pendingUploads.length

  const orgLogoUrl = useOrgLogo(
    playground ? undefined : member?.orgId,
    playground ? null : member?.orgLogoR2Key,
  )

  const hasModule = (m: AppModuleId) => (playground ? true : member?.hasModule(m) ?? true)
  const fallbackRoute = getFallbackModuleRoute(playground ? undefined : member?.hasModule.bind(member))

  // Dynamically filter module navigation items based on org enabled modules
  const enabledModuleNav = MODULE_NAV_DEFINITIONS.filter((item) =>
    hasModule(item.moduleId),
  )

  const sidebarNav: readonly NavItemDef[] = [
    ...enabledModuleNav,
    ...BASE_SIDEBAR_NAV,
  ]

  const primaryPaths = new Set<string>(sidebarNav.map((item) => item.to))
  const isPrimaryScreen = isPrimaryPath(pathname, primaryPaths)

  if (!playground) {
    if (loading) {
      return <SplashScreen />
    }

    if (!member || !member.setupCompleted) {
      if (!member || member.role === 'admin') {
        return (
          <Routes>
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </Routes>
        )
      }
      return <SetupWaitingScreen />
    }
  }

  return (
    <div
      className={[
        'app-shell',
        isPrimaryScreen ? 'app-shell--primary' : '',
        sidebarCollapsed ? 'app-shell--sidebar-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {playground ? null : <SyncBanner />}
      <div
        className={`sidebar-backdrop ${mobileDrawerOpen ? 'open' : ''}`}
        onClick={() => setMobileDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={[
          'app-sidebar',
          sidebarCollapsed ? 'app-sidebar--collapsed' : '',
          mobileDrawerOpen ? 'app-sidebar--mobile-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Sidebar"
      >
        <div className="app-sidebar__header">
          <div className="app-sidebar__brand-lockup">
            <button
              type="button"
              className="sidebar-logo-btn"
              title={
                sidebarCollapsed
                  ? 'Expand sidebar'
                  : member?.orgName || 'Sanctuary'
              }
              aria-label={
                sidebarCollapsed
                  ? 'Expand sidebar'
                  : member?.orgName || 'Sanctuary'
              }
              onClick={(e) => {
                if (sidebarCollapsed) {
                  e.stopPropagation()
                  toggleSidebarCollapsed()
                }
              }}
            >
              <div className="sidebar-logo-img">
                {orgLogoUrl ? (
                  <img
                    className="app-sidebar__logo"
                    src={orgLogoUrl}
                    alt=""
                    width={36}
                    height={36}
                  />
                ) : (
                  <SanctuaryLogo size={36} />
                )}
              </div>
              <span className="collapsed-hover-icon" title="Expand sidebar">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="18" height="18" x="3" y="3" rx="3" />
                  <path d="M9 3v18" />
                </svg>
              </span>
            </button>
            <div className="app-sidebar__brand-text">
              <div className="app-sidebar__brand-row">
                <div
                  className="app-sidebar__brand"
                  title={member?.orgName || 'Sanctuary'}
                >
                  {member?.orgName || 'Sanctuary'}
                </div>
                <PwaUpdatePill />
              </div>
            </div>
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => {
                if (mobileDrawerOpen) {
                  setMobileDrawerOpen(false)
                } else {
                  toggleSidebarCollapsed()
                }
              }}
              title={
                mobileDrawerOpen
                  ? 'Close navigation menu'
                  : sidebarCollapsed
                    ? 'Expand sidebar'
                    : 'Collapse sidebar'
              }
              aria-label={
                mobileDrawerOpen
                  ? 'Close navigation menu'
                  : sidebarCollapsed
                    ? 'Expand sidebar'
                    : 'Collapse sidebar'
              }
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="3" />
                <path d="M9 3v18" />
              </svg>
            </button>
          </div>
        </div>
        <NavItems
          className="app-sidebar__nav"
          items={sidebarNav}
          badges={{ '/uploads': uploadBadge }}
          onItemClick={() => setMobileDrawerOpen(false)}
        />
        <div className="app-sidebar__footer">
          <div className="app-sidebar__copyright">
            Sanctuary &copy; {new Date().getFullYear()}
          </div>
          <a
            className="app-sidebar__mohsin"
            href="https://themohsinproject.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>A free software by The Mohsin Project</span>
            <img
              src="/mohsin-project-logo.svg"
              alt=""
              width={24}
              height={14}
              aria-hidden
            />
          </a>
        </div>
      </aside>
      <div className="app-shell__body">
        {playground ? <PlaygroundBanner /> : null}
        {isPrimaryScreen ? (
          <button
            type="button"
            className="mobile-drawer-trigger"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation menu"
            title="Open navigation menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="3" />
              <path d="M9 3v18" />
            </svg>
            {hasUpdate && !modalOpen ? (
              <span className="mobile-drawer-trigger__dot" aria-hidden="true" />
            ) : null}
          </button>
        ) : null}
        <main className="app-content" id="main">
          <Routes>
            <Route path="/" element={<Navigate to={fallbackRoute} replace />} />

            {/* Animals module */}
            <Route
              path="/animals"
              element={
                hasModule('animals') ? (
                  <AnimalsListScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/animals/filters"
              element={
                hasModule('animals') ? (
                  <AnimalsFiltersScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/animals/add-to-checklist"
              element={
                hasModule('animals') ? (
                  <AddToChecklistScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/animals/camera"
              element={
                hasModule('animals') ? (
                  <Navigate to="/animals/new" replace />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/animals/new"
              element={
                hasModule('animals') ? (
                  <AnimalIntakeScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/animals/:id/edit"
              element={
                hasModule('animals') ? (
                  <AnimalIntakeScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/animals/:id"
              element={
                hasModule('animals') ? (
                  <AnimalDetailScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />

            {/* Ledger module */}
            <Route
              path="/ledger"
              element={
                hasModule('ledger') ? (
                  <LedgerScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/ledger/new"
              element={
                hasModule('ledger') ? (
                  <LedgerEntryScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/ledger/:id"
              element={
                hasModule('ledger') ? (
                  <LedgerEntryScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />

            {/* Checklist module */}
            <Route
              path="/checklist"
              element={
                hasModule('checklist') ? (
                  <ChecklistScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />

            {/* Reports module */}
            <Route
              path="/reports"
              element={
                hasModule('reports') ? (
                  <ReportsListScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/reports/new"
              element={
                hasModule('reports') ? (
                  <ReportIntakeScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/reports/:id/edit"
              element={
                hasModule('reports') ? (
                  <ReportIntakeScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
            <Route
              path="/reports/:id"
              element={
                hasModule('reports') ? (
                  <ReportDetailScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />

            {/* Standard non-modular routes */}
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/uploads" element={<UploadsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route
              path="/onboarding"
              element={
                playground ? (
                  <OnboardingScreen />
                ) : (
                  <Navigate to={fallbackRoute} replace />
                )
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <PwaUpdateProvider>
      <AppShellContent />
      <PwaUpdateModal />
    </PwaUpdateProvider>
  )
}

