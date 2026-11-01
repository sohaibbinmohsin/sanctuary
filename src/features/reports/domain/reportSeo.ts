import { useEffect, useRef } from 'react'

export interface SeoConfig {
  title: string
  description: string
  ogImage?: string
  ogTitle?: string
  ogDescription?: string
}

export const REPORT_INTAKE_SEO: SeoConfig = {
  title: 'Sanctuary | Report an Animal in Distress',
  description:
    'Emergency animal rescue reporting network. Log an injured, sick, or distressed animal with photos and location for rapid responder dispatch.',
  ogImage: '/og-report.jpg',
  ogTitle: 'Sanctuary | Report an Animal in Distress',
  ogDescription:
    'Emergency animal rescue reporting network. Log an injured, sick, or distressed animal with photos and location for rapid responder dispatch.',
}

function setOrCreateMeta(
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string
): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const selector = `meta[${attributeName}="${attributeValue}"]`
  let element = document.querySelector<HTMLMetaElement>(selector)
  const existedInitially = Boolean(element)
  const previousContent = element ? element.getAttribute('content') : null

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attributeName, attributeValue)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)

  return () => {
    const current = document.querySelector<HTMLMetaElement>(selector)
    if (!current) return

    if (existedInitially && previousContent !== null) {
      current.setAttribute('content', previousContent)
    } else if (!existedInitially) {
      current.remove()
    }
  }
}

export function useReportSeo(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const previousTitle = document.title
    document.title = REPORT_INTAKE_SEO.title

    const cleanups = [
      setOrCreateMeta('name', 'description', REPORT_INTAKE_SEO.description),
      setOrCreateMeta('property', 'og:title', REPORT_INTAKE_SEO.ogTitle ?? REPORT_INTAKE_SEO.title),
      setOrCreateMeta(
        'property',
        'og:description',
        REPORT_INTAKE_SEO.ogDescription ?? REPORT_INTAKE_SEO.description
      ),
      setOrCreateMeta('property', 'og:image', REPORT_INTAKE_SEO.ogImage ?? '/og-report.jpg'),
      setOrCreateMeta('name', 'twitter:card', 'summary_large_image'),
      setOrCreateMeta('name', 'twitter:title', REPORT_INTAKE_SEO.ogTitle ?? REPORT_INTAKE_SEO.title),
      setOrCreateMeta(
        'name',
        'twitter:description',
        REPORT_INTAKE_SEO.ogDescription ?? REPORT_INTAKE_SEO.description
      ),
      setOrCreateMeta('name', 'twitter:image', REPORT_INTAKE_SEO.ogImage ?? '/og-report.jpg'),
    ]

    return () => {
      document.title = previousTitle
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [])
}

export function useReportTrackSeo(reportNumber?: string, status?: string): void {
  const originalTitleRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return

    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title
    }

    const caseIdentifier =
      reportNumber && reportNumber.trim().length > 0 ? reportNumber.trim() : '...'
    const title = `Sanctuary | Track Rescue Case #${caseIdentifier}`
    const description = `Live dispatch and rescue tracking for Case #${caseIdentifier}. Real-time updates from field teams.`

    document.title = title

    const cleanups = [
      setOrCreateMeta('name', 'description', description),
      setOrCreateMeta('property', 'og:title', title),
      setOrCreateMeta('property', 'og:description', description),
      setOrCreateMeta('property', 'og:image', '/og-report.jpg'),
      setOrCreateMeta('name', 'twitter:card', 'summary_large_image'),
      setOrCreateMeta('name', 'twitter:title', title),
      setOrCreateMeta('name', 'twitter:description', description),
      setOrCreateMeta('name', 'twitter:image', '/og-report.jpg'),
    ]

    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [reportNumber, status])

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && originalTitleRef.current !== null) {
        document.title = originalTitleRef.current
      }
    }
  }, [])
}
