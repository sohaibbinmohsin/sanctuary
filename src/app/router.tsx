import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  Cat,
  CheckSquare,
  CloudArrowUp,
  CurrencyCircleDollar,
  ChartBar,
  GearSix,
} from '@phosphor-icons/react'
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

const SIDEBAR_NAV = [
  { to: '/animals', label: 'Animals', icon: Cat },
  { to: '/ledger', label: 'Ledger', icon: CurrencyCircleDollar },
  { to: '/checklist', label: 'Checklist', icon: CheckSquare },
  { to: '/dashboard', label: 'Overview', icon: ChartBar },
  { to: '/uploads', label: 'Uploads', icon: CloudArrowUp },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const

const BOTTOM_NAV = [
  { to: '/animals', label: 'Animals', icon: Cat },
  { to: '/ledger', label: 'Ledger', icon: CurrencyCircleDollar },
  { to: '/dashboard', label: 'Overview', icon: ChartBar },
  { to: '/checklist', label: 'Checklist', icon: CheckSquare },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const

const PRIMARY_PATHS = new Set<string>(BOTTOM_NAV.map((item) => item.to))

function isPrimaryPath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return PRIMARY_PATHS.has(normalized)
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
            end={to === '/animals' || to === '/ledger' ? false : undefined}
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
  const showBottomNav = isPrimaryPath(pathname)
  useMediaUploadRunner(playground ? null : db)
  const { items: pendingUploads } = usePendingMedia(
    playground ? undefined : member?.orgId,
  )
  const uploadBadge = pendingUploads.length

  if (!playground) {
    if (loading) {
      return <SplashScreen />
    }

    if (member && !member.setupCompleted) {
      if (member.role === 'admin') {
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
          items={SIDEBAR_NAV}
          badges={{ '/uploads': uploadBadge }}
        />
        <HelpAndAccount variant="sidebar" />
      </aside>
      <div className="app-shell__body">
        {playground ? <PlaygroundBanner /> : null}
        <main className="app-content" id="main">
          <Routes>
            <Route path="/" element={<Navigate to="/animals" replace />} />
            <Route path="/animals" element={<AnimalsListScreen />} />
            <Route path="/animals/filters" element={<AnimalsFiltersScreen />} />
            <Route
              path="/animals/add-to-checklist"
              element={<AddToChecklistScreen />}
            />
            <Route path="/animals/new" element={<AnimalIntakeScreen />} />
            <Route path="/animals/:id/edit" element={<AnimalIntakeScreen />} />
            <Route path="/animals/:id" element={<AnimalDetailScreen />} />
            <Route path="/ledger" element={<LedgerScreen />} />
            <Route path="/ledger/new" element={<LedgerEntryScreen />} />
            <Route path="/ledger/:id" element={<LedgerEntryScreen />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/uploads" element={<UploadsScreen />} />
            <Route path="/checklist" element={<ChecklistScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/onboarding" element={<Navigate to="/animals" replace />} />
          </Routes>
        </main>
        {showBottomNav ? <NavItems className="app-nav" items={BOTTOM_NAV} /> : null}
      </div>
    </div>
  )
}
