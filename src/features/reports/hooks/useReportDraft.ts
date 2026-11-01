import { useState, useCallback } from 'react'

export const REPORT_DRAFT_KEY = 'sanctuary_report_draft_v1'

export type ReportDraftState = {
  currentStep: 1 | 2 | 3
  category: string
  intakeCountMode: 'single' | 'litter' | 'multiple'
  litterComposition: 'offspring_only' | 'mother_and_offspring'
  animalCount: number
  speciesPreset: string
  speciesOther: string
  avianSubtype: string
  lifeStage: 'adult' | 'child'
  chiefComplaint: string
  city: string
  locationArea: string
  locationLandmark: string
  latitude: number | null
  longitude: number | null
  reporterName: string
  reporterPhone: string
  reporterCnic: string
  rememberProfile: boolean
}

export const INITIAL_DRAFT: ReportDraftState = {
  currentStep: 1,
  category: 'emergency',
  intakeCountMode: 'single',
  litterComposition: 'offspring_only',
  animalCount: 1,
  speciesPreset: 'Dog',
  speciesOther: '',
  avianSubtype: '',
  lifeStage: 'adult',
  chiefComplaint: '',
  city: 'Lahore',
  locationArea: '',
  locationLandmark: '',
  latitude: null,
  longitude: null,
  reporterName: '',
  reporterPhone: '',
  reporterCnic: '',
  rememberProfile: true,
}

export function useReportDraft() {
  const [draft, setDraft] = useState<ReportDraftState>(() => {
    try {
      const saved = localStorage.getItem(REPORT_DRAFT_KEY)
      if (saved) return { ...INITIAL_DRAFT, ...JSON.parse(saved) }
    } catch {}
    return INITIAL_DRAFT
  })

  const updateDraft = useCallback((patch: Partial<ReportDraftState>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(REPORT_DRAFT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(INITIAL_DRAFT)
    try {
      localStorage.removeItem(REPORT_DRAFT_KEY)
    } catch {}
  }, [])

  return { draft, updateDraft, clearDraft }
}
