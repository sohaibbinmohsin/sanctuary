import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  Cat,
  CurrencyCircleDollar,
  ChartBar,
  GearSix,
} from '@phosphor-icons/react'
import { SyncBanner } from '@/shared/ui/SyncBanner'
import { PlaygroundBanner } from '@/features/playground/PlaygroundBanner'
import { isPlaygroundMode } from '@/features/playground/mode'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import { AnimalsFiltersScreen } from '@/features/animals/screens/AnimalsFiltersScreen'
import { AnimalIntakeScreen } from '@/features/animals/screens/AnimalIntakeScreen'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'
import { LedgerScreen } from '@/features/ledger/screens/LedgerScreen'
import { LedgerEntryScreen } from '@/features/ledger/screens/LedgerEntryScreen'
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen'
import { ChecklistScreen } from '@/features/checklist/screens/ChecklistScreen'
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'

const NAV = [
  { to: '/animals', label: 'Animals', icon: Cat },
  { to: '/ledger', label: 'Ledger', icon: CurrencyCircleDollar },
  { to: '/dashboard', label: 'Overview', icon: ChartBar },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const

const PRIMARY_PATHS = new Set<string>(NAV.map((item) => item.to))

function isPrimaryPath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return PRIMARY_PATHS.has(normalized)
}

function NavItems({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/animals' || to === '/ledger' ? false : undefined}
        >
          <Icon weight="duotone" aria-hidden />
          <span className="app-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { member } = useCurrentMember()
  const playground = isPlaygroundMode()
  const { pathname } = useLocation()
  const showBottomNav = isPrimaryPath(pathname)

  return (
    <div
      className={
        showBottomNav ? 'app-shell' : 'app-shell app-shell--no-bottom-nav'
      }
    >
      {playground ? null : <SyncBanner />}
      <aside className="app-sidebar" aria-label="Sidebar">
        <div>
          <div className="app-sidebar__brand">Sanctuary</div>
          {member?.orgName ? (
            <div className="app-sidebar__org">{member.orgName}</div>
          ) : null}
        </div>
        <NavItems className="app-sidebar__nav" />
      </aside>
      <div className="app-shell__body">
        {playground ? <PlaygroundBanner /> : null}
        <main className="app-content" id="main">
          <Routes>
            <Route path="/" element={<Navigate to="/animals" replace />} />
            <Route path="/animals" element={<AnimalsListScreen />} />
            <Route path="/animals/filters" element={<AnimalsFiltersScreen />} />
            <Route path="/animals/new" element={<AnimalIntakeScreen />} />
            <Route path="/animals/:id/edit" element={<AnimalIntakeScreen />} />
            <Route path="/animals/:id" element={<AnimalDetailScreen />} />
            <Route path="/ledger" element={<LedgerScreen />} />
            <Route path="/ledger/new" element={<LedgerEntryScreen />} />
            <Route path="/ledger/:id" element={<LedgerEntryScreen />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/checklist" element={<ChecklistScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
        {showBottomNav ? <NavItems className="app-nav" /> : null}
      </div>
    </div>
  )
}
