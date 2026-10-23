import type { SanctuaryDb } from '@/shared/lib/db'
import { formatEnabledModules, type AppModuleId } from '@/shared/domain/modules'

export async function updateOrganizationModules(
  db: SanctuaryDb,
  orgId: string,
  modules: AppModuleId[],
): Promise<void> {
  const jsonValue = formatEnabledModules(modules)
  await db.execute(
    `UPDATE organizations SET enabled_modules = ? WHERE id = ?`,
    [jsonValue, orgId],
  )
}
