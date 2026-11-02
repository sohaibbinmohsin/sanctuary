import { useState, useEffect, useCallback } from 'react'
import {
  type ReportLanguage,
  type ReportTranslations,
  getReportTranslations,
} from '@/features/reports/domain/reportTranslations'

const STORAGE_KEY = 'sanctuary_report_lang_v1'

export interface UseReportLanguageReturn {
  lang: ReportLanguage
  setLang: (lang: ReportLanguage) => void
  toggleLang: () => void
  isRtl: boolean
  t: ReportTranslations
}

export function useReportLanguage(): UseReportLanguageReturn {
  const [lang, setLangState] = useState<ReportLanguage>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const qLang = params.get('lang')
        if (qLang === 'ur' || qLang === 'en') return qLang
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'ur' || stored === 'en') return stored
      }
    } catch {}
    return 'en'
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
  }, [lang])

  const setLang = useCallback((nextLang: ReportLanguage) => {
    setLangState(nextLang)
  }, [])

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'en' ? 'ur' : 'en'))
  }, [])

  const isRtl = lang === 'ur'
  const t = getReportTranslations(lang)

  return {
    lang,
    setLang,
    toggleLang,
    isRtl,
    t,
  }
}
