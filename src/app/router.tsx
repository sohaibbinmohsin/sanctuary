import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  Cat,
  CurrencyCircleDollar,
  ChartBar,
  GearSix,
} from '@phosphor-icons/react'
import { SyncBanner } from '@/shared/ui/SyncBanner'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import { AnimalIntakeScreen } from '@/features/animals/screens/AnimalIntakeScreen'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'
import { LedgerScreen } from '@/features/ledger/screens/LedgerScreen'
import { LedgerEntryScreen } from '@/features/ledger/screens/LedgerEntryScreen'
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen'
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'

const NAV = [
  { to: '/animals', label: 'Animals', icon: Cat },
  { to: '/ledger', label: 'Money', icon: CurrencyCircleDollar },
  { to: '/dashboard', label: 'Overview', icon: ChartBar },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const

function NavItems({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/animals' || to === '/ledger' ? false : undefined}>
          <Icon weight="duotone" aria-hidden />
          <span className="app-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { member } = useCurrentMember()

  return (
    <div className="app-shell">
      <SyncBanner />
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
        <main className="app-content" id="main">
          <Routes>
            <Route path="/" element={<Navigate to="/animals" replace />} />
            <Route path="/animals" element={<AnimalsListScreen />} />
            <Route path="/animals/new" element={<AnimalIntakeScreen />} />
            <Route path="/animals/:id" element={<AnimalDetailScreen />} />
            <Route path="/ledger" element={<LedgerScreen />} />
            <Route path="/ledger/new" element={<LedgerEntryScreen />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
        <NavItems className="app-nav" />
      </div>
    </div>
  )
}
