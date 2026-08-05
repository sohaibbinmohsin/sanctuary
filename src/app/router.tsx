import { NavLink, Route, Routes } from 'react-router-dom'
import { SyncBanner } from '@/shared/ui/SyncBanner'
import { AnimalsListScreen } from '@/features/animals/screens/AnimalsListScreen'
import { AnimalIntakeScreen } from '@/features/animals/screens/AnimalIntakeScreen'
import { AnimalDetailScreen } from '@/features/animals/screens/AnimalDetailScreen'
import { LedgerScreen } from '@/features/ledger/screens/LedgerScreen'
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen'
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen'

export function AppShell() {
  return (
    <div className="app-shell">
      <SyncBanner />
      <header className="app-header">
        <span className="brand-mark">Sanctuary</span>
      </header>
      <div className="app-content">
        <Routes>
          <Route path="/" element={<AnimalsListScreen />} />
          <Route path="/animals" element={<AnimalsListScreen />} />
          <Route path="/animals/new" element={<AnimalIntakeScreen />} />
          <Route path="/animals/:id" element={<AnimalDetailScreen />} />
          <Route path="/ledger" element={<LedgerScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </div>
      <nav className="app-nav" aria-label="Main">
        <NavLink to="/animals">Animals</NavLink>
        <NavLink to="/ledger">Ledger</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </div>
  )
}
