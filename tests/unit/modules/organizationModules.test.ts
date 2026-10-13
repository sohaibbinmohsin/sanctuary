import { describe, it, expect } from 'vitest'
import {
  parseEnabledModules,
  formatEnabledModules,
  MODULE_PRESETS,
} from '@/shared/domain/modules'

describe('organizationModules', () => {
  it('defaults to all modules when raw is null, undefined, or empty', () => {
    const modules = parseEnabledModules(null)
    expect(modules.has('reports')).toBe(true)
    expect(modules.has('animals')).toBe(true)
    expect(modules.has('checklist')).toBe(true)
    expect(modules.has('ledger')).toBe(true)
  })

  it('correctly parses JSON array of modules', () => {
    const modules = parseEnabledModules(JSON.stringify(['animals', 'checklist']))
    expect(modules.has('animals')).toBe(true)
    expect(modules.has('checklist')).toBe(true)
    expect(modules.has('reports')).toBe(false)
    expect(modules.has('ledger')).toBe(false)
  })

  it('formats modules into clean JSON string', () => {
    const json = formatEnabledModules(['animals', 'reports'])
    const parsed = JSON.parse(json)
    expect(parsed).toEqual(['animals', 'reports'])
  })

  it('provides standard presets matching requirements', () => {
    expect(MODULE_PRESETS.full).toEqual(['reports', 'animals', 'checklist', 'ledger'])
    expect(MODULE_PRESETS.sanctuary_only).toEqual(['animals', 'checklist', 'ledger'])
    expect(MODULE_PRESETS.hotline).toEqual(['reports', 'animals'])
    expect(MODULE_PRESETS.clinic).toEqual(['animals', 'checklist'])
  })
})
