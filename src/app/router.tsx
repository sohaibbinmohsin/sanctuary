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
import { HelpAndAccount } from '@/features/settings/components/HelpAndAccount'
import { SplashScreen } from '@/shared/ui/SplashScreen'
import { OnboardingScreen } from '@/features/onboarding/screens/OnboardingScreen'
import { SetupWaitingScreen } from '@/features/onboarding/screens/SetupWaitingScreen'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { useDb } from '@/shared/hooks/useDb'
import { useMediaUploadRunner } from '@/features/uploads/hooks/useMediaUploadRunner'
import { usePendingMedia } from '@/features/uploads/hooks/usePendingMedia'

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

const BASE_BOTTOM_NAV: readonly NavItemDef[] = [
  { to: '/dashboard', label: 'Overview', icon: ChartBar },
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
}: {
  className: string
  items: readonly {
    to: string
    label: string
    icon: typeof Cat
  }[]
  badges?: Partial<Record<string, number>>
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

export function AppShell() {
  const db = useDb()
  const { member, loading } = useCurrentMember()
  const playground = isPlaygroundMode()
  const { pathname } = useLocation()

  useMediaUploadRunner(playground ? null : db)
  const { items: pendingUploads } = usePendingMedia(
    playground ? undefined : member?.orgId,
  )
  const uploadBadge = pendingUploads.length

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

  const bottomNav: readonly NavItemDef[] = [
    ...enabledModuleNav,
    ...(enabledModuleNav.length >= 4
      ? BASE_BOTTOM_NAV.filter((item) => item.to !== '/settings')
      : BASE_BOTTOM_NAV),
  ]

  const primaryPaths = new Set<string>(bottomNav.map((item) => item.to))
  const showBottomNav = isPrimaryPath(pathname, primaryPaths)

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
      className={
        showBottomNav ? 'app-shell' : 'app-shell app-shell--no-bottom-nav'
      }
    >
      {playground ? null : <SyncBanner />}
      <aside className="app-sidebar" aria-label="Sidebar">
        <div className="app-sidebar__header">
          <div className="app-sidebar__brand-lockup">
            <img
              className="app-sidebar__logo"
              src="/sanctuary-logo.svg"
              alt=""
              width={36}
              height={36}
            />
            <div className="app-sidebar__brand-text">
              <div className="app-sidebar__brand">Sanctuary</div>
              {member?.orgName ? (
                <div className="app-sidebar__org">{member.orgName}</div>
              ) : null}
            </div>
          </div>
        </div>
        <NavItems
          className="app-sidebar__nav"
          items={sidebarNav}
          badges={{ '/uploads': uploadBadge }}
        />
        <HelpAndAccount variant="sidebar" />
      </aside>
      <div className="app-shell__body">
        {playground ? <PlaygroundBanner /> : null}
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
        {showBottomNav ? <NavItems className="app-nav" items={bottomNav} /> : null}
      </div>
    </div>
  )
}
