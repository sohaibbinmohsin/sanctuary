export type AppModuleId = 'reports' | 'animals' | 'checklist' | 'ledger'

export const ALL_MODULE_IDS: readonly AppModuleId[] = [
  'reports',
  'animals',
  'checklist',
  'ledger',
] as const

export const MODULE_PRESETS = {
  full: ['reports', 'animals', 'checklist', 'ledger'],
  sanctuary_only: ['animals', 'checklist', 'ledger'],
  hotline: ['reports', 'animals'],
  clinic: ['animals', 'checklist'],
} as const satisfies Record<string, readonly AppModuleId[]>

export type ModulePresetKey = keyof typeof MODULE_PRESETS | 'custom'

export const DEFAULT_MODULE_IDS: readonly AppModuleId[] = [
  'animals',
  'checklist',
  'ledger',
] as const

export function parseEnabledModules(raw: string | null | undefined): Set<AppModuleId> {
  if (!raw || !raw.trim()) {
    return new Set(DEFAULT_MODULE_IDS)
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((m): m is AppModuleId =>
        ALL_MODULE_IDS.includes(m as AppModuleId),
      )
      return new Set(valid.length > 0 ? valid : DEFAULT_MODULE_IDS)
    }
  } catch {
    // fallback comma-separated
    const parts = raw.split(',').map((p) => p.trim())
    const valid = parts.filter((m): m is AppModuleId =>
      ALL_MODULE_IDS.includes(m as AppModuleId),
    )
    if (valid.length > 0) return new Set(valid)
  }
  return new Set(DEFAULT_MODULE_IDS)
}

export function formatEnabledModules(modules: Iterable<AppModuleId>): string {
  return JSON.stringify(Array.from(modules))
}
