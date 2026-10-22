import { useEffect, useState } from 'react'
import { GearSix } from '@phosphor-icons/react'
import type { AppModuleId } from '@/shared/domain/modules'
import { OverviewChecklistCard } from '@/features/checklist/components/OverviewChecklistCard'
import { OverviewUploadsCard } from '@/features/uploads/components/OverviewUploadsCard'
import { RescueOperationsSummaryCard } from '@/features/reports/components/overview/RescueOperationsSummaryCard'
import { RescueCategoryCard } from '@/features/reports/components/overview/RescueCategoryCard'
import { RescueSpeciesCard } from '@/features/reports/components/overview/RescueSpeciesCard'
import { RescueHotspotsCard } from '@/features/reports/components/overview/RescueHotspotsCard'
import { RescueTrendCard } from '@/features/reports/components/overview/RescueTrendCard'
import { ShelterHeadcountCard } from '@/features/animals/components/overview/ShelterHeadcountCard'
import { AnimalsByStatusCard } from '@/features/animals/components/overview/AnimalsByStatusCard'
import { AnimalsSpeciesCard } from '@/features/animals/components/overview/AnimalsSpeciesCard'
import { FinancialSummaryCard } from '@/features/ledger/components/overview/FinancialSummaryCard'
import { LedgerTrendCard } from '@/features/ledger/components/overview/LedgerTrendCard'
import { ExpenseCategoriesCard } from '@/features/ledger/components/overview/ExpenseCategoriesCard'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { isPlaygroundMode } from '@/features/playground/mode'
import { DASHBOARD_GREETINGS, pickMessage } from '@/shared/lib/morale/messages'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'

const GREETING_KEY = 'sanctuary.dashboardGreetingShown'

export function DashboardScreen() {
  const { member } = useCurrentMember()
  const isPlayground = isPlaygroundMode()
  const [greeting, setGreeting] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionStorage.getItem(GREETING_KEY)) {
      sessionStorage.setItem(GREETING_KEY, '1')
      setGreeting(pickMessage(DASHBOARD_GREETINGS))
    }
  }, [])

  const hasModule = (m: AppModuleId) => (isPlayground ? true : member?.hasModule(m) ?? true)

  const allModulesActive = Boolean(
    hasModule('reports') &&
    hasModule('animals') &&
    hasModule('ledger') &&
    hasModule('checklist')
  )

  return (
    <section className="screen">
      <PageHeader
        title="Overview"
        subtitle={greeting ?? 'Telemetry and operations overview for your team.'}
        actions={
          allModulesActive ? (
            <Button
              to="/settings"
              variant="secondary"
              className="btn--icon mobile-only"
              aria-label="Settings"
              title="Settings"
            >
              <GearSix size={20} weight="duotone" aria-hidden />
            </Button>
          ) : undefined
        }
      />

      {/* Uploads Queue (system level) */}
      <OverviewUploadsCard />

      {/* Rescue Reports Module */}
      {hasModule('reports') && (
        <>
          <RescueOperationsSummaryCard />
          <RescueCategoryCard />
          <RescueSpeciesCard />
          <RescueHotspotsCard />
          <RescueTrendCard />
        </>
      )}

      {/* Animal Records Module */}
      {hasModule('animals') && (
        <>
          <ShelterHeadcountCard />
          <AnimalsByStatusCard />
          <AnimalsSpeciesCard />
        </>
      )}

      {/* Daily Checklist Module */}
      {hasModule('checklist') && (
        <OverviewChecklistCard />
      )}

      {/* Financial Ledger Module */}
      {hasModule('ledger') && (
        <>
          <FinancialSummaryCard />
          <LedgerTrendCard />
          <ExpenseCategoriesCard />
        </>
      )}
    </section>
  )
}
