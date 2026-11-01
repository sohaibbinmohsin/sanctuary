import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReportDraft, REPORT_DRAFT_KEY } from '@/features/reports/hooks/useReportDraft'

describe('useReportDraft', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with default empty draft', () => {
    const { result } = renderHook(() => useReportDraft())
    expect(result.current.draft.category).toBe('emergency')
    expect(result.current.draft.speciesPreset).toBe('Dog')
  })

  it('saves updates to localStorage', () => {
    const { result } = renderHook(() => useReportDraft())
    act(() => {
      result.current.updateDraft({ chiefComplaint: 'Fractured rear leg' })
    })
    expect(result.current.draft.chiefComplaint).toBe('Fractured rear leg')
    const stored = JSON.parse(localStorage.getItem(REPORT_DRAFT_KEY) || '{}')
    expect(stored.chiefComplaint).toBe('Fractured rear leg')
  })

  it('clears draft from localStorage', () => {
    const { result } = renderHook(() => useReportDraft())
    act(() => {
      result.current.updateDraft({ chiefComplaint: 'Test' })
      result.current.clearDraft()
    })
    expect(localStorage.getItem(REPORT_DRAFT_KEY)).toBeNull()
  })
})
