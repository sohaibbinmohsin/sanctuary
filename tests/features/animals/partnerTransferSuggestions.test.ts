import { describe, it, expect } from 'vitest'
import { getCombinedPartnerSuggestions } from '@/features/reports/domain/partnerDirectory'

describe('getCombinedPartnerSuggestions', () => {
  it('returns both clinics and partner shelters matching query', async () => {
    const suggestions = await getCombinedPartnerSuggestions(null, 'org-1', '')
    const names = suggestions.map((s) => s.name)
    expect(names).toContain('UVAS Small Animal Hospital')
    expect(names).toContain("Todd's Welfare Society (TWS)")
  })

  it('filters suggestions case-insensitively', async () => {
    const suggestions = await getCombinedPartnerSuggestions(null, 'org-1', 'uvas')
    expect(suggestions.length).toBeGreaterThanOrEqual(1)
    expect(suggestions[0].name).toContain('UVAS')
  })
})
