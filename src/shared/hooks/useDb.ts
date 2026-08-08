import { usePowerSync } from '@powersync/react'
import { asDb, type SanctuaryDb } from '@/shared/lib/db'

export function useDb(): SanctuaryDb {
  return asDb(usePowerSync())
}
