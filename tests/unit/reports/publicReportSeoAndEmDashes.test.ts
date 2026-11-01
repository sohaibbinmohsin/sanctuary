import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import {
  useReportSeo,
  useReportTrackSeo,
  REPORT_INTAKE_SEO,
} from '@/features/reports/domain/reportSeo'

describe('Zero em-dashes and double hyphens verification across public report files', () => {
  const filesToCheck = [
    'src/features/reports/components/public/PublicReportStepAnimal.tsx',
    'src/features/reports/components/public/PublicReportStepLocation.tsx',
    'src/features/reports/components/public/PublicReportStepContact.tsx',
    'src/features/reports/screens/PublicReportScreen.tsx',
    'src/features/reports/screens/PublicReportTrackScreen.tsx',
    'src/features/reports/publicReport.css',
    'src/features/reports/domain/privacyMask.ts',
    'src/features/reports/domain/reportSeo.ts',
  ]

  for (const relativePath of filesToCheck) {
    it(`verifies no em-dash unicode or punctuation double-hyphen in ${relativePath}`, () => {
      const fullPath = path.resolve(process.cwd(), relativePath)
      expect(fs.existsSync(fullPath)).toBe(true)
      const content = fs.readFileSync(fullPath, 'utf8')

      // 1. Strictly no unicode em-dash anywhere
      expect(content).not.toContain('\u2014')
      expect(content).not.toContain('&mdash;')

      // 2. Strictly no em-dash or double-hyphen in comments
      const commentMatches = [
        ...content.matchAll(/\/\/.*$/gm),
        ...content.matchAll(/\/\*[\s\S]*?\*\//g),
      ].map((match) => match[0])

      for (const comment of commentMatches) {
        expect(comment).not.toContain('\u2014')
        expect(comment).not.toContain('--')
      }

      // 3. For TypeScript domain files, strictly zero double hyphens anywhere in file
      if (relativePath.endsWith('privacyMask.ts') || relativePath.endsWith('reportSeo.ts')) {
        expect(content).not.toContain('--')
      }
    })
  }
})

describe('Dedicated OG report social card asset', () => {
  it('verifies public/og-report.jpg exists and is non-empty (> 10KB)', () => {
    const ogPath = path.resolve(process.cwd(), 'public/og-report.jpg')
    expect(fs.existsSync(ogPath)).toBe(true)

    const stats = fs.statSync(ogPath)
    expect(stats.size).toBeGreaterThan(10 * 1024)
  })
})

describe('useReportSeo', () => {
  const originalTitle = 'Sanctuary | Animal welfare network'

  beforeEach(() => {
    document.title = originalTitle
  })

  afterEach(() => {
    document.title = originalTitle
  })

  it('sets document title and meta tags on mount', () => {
    const { unmount } = renderHook(() => useReportSeo())

    expect(document.title).toBe(REPORT_INTAKE_SEO.title)

    const metaDescription = document.querySelector('meta[name="description"]')
    expect(metaDescription?.getAttribute('content')).toBe(REPORT_INTAKE_SEO.description)

    const ogTitle = document.querySelector('meta[property="og:title"]')
    expect(ogTitle?.getAttribute('content')).toBe(REPORT_INTAKE_SEO.ogTitle)

    const ogDescription = document.querySelector('meta[property="og:description"]')
    expect(ogDescription?.getAttribute('content')).toBe(REPORT_INTAKE_SEO.ogDescription)

    const ogImage = document.querySelector('meta[property="og:image"]')
    expect(ogImage?.getAttribute('content')).toBe('/og-report.jpg')

    const twitterCard = document.querySelector('meta[name="twitter:card"]')
    expect(twitterCard?.getAttribute('content')).toBe('summary_large_image')

    const twitterImage = document.querySelector('meta[name="twitter:image"]')
    expect(twitterImage?.getAttribute('content')).toBe('/og-report.jpg')

    unmount()
    expect(document.title).toBe(originalTitle)
  })
})

describe('useReportTrackSeo', () => {
  const originalTitle = 'Sanctuary | Animal welfare network'

  beforeEach(() => {
    document.title = originalTitle
  })

  afterEach(() => {
    document.title = originalTitle
  })

  it('updates document title with case number and reverts on unmount', () => {
    const { unmount } = renderHook(() =>
      useReportTrackSeo('SANCTUARY-0142', 'dispatched')
    )

    expect(document.title).toBe('Sanctuary | Track Rescue Case #SANCTUARY-0142')

    const metaDescription = document.querySelector('meta[name="description"]')
    expect(metaDescription?.getAttribute('content')).toBe(
      'Live dispatch and rescue tracking for Case #SANCTUARY-0142. Real-time updates from field teams.'
    )

    const ogTitle = document.querySelector('meta[property="og:title"]')
    expect(ogTitle?.getAttribute('content')).toBe(
      'Sanctuary | Track Rescue Case #SANCTUARY-0142'
    )

    unmount()
    expect(document.title).toBe(originalTitle)
  })

  it('falls back to ellipsis when reportNumber is undefined or empty', () => {
    const { unmount } = renderHook(() => useReportTrackSeo(undefined))

    expect(document.title).toBe('Sanctuary | Track Rescue Case #...')

    const metaDescription = document.querySelector('meta[name="description"]')
    expect(metaDescription?.getAttribute('content')).toBe(
      'Live dispatch and rescue tracking for Case #.... Real-time updates from field teams.'
    )

    unmount()
    expect(document.title).toBe(originalTitle)
  })

  it('updates dynamically when reportNumber changes', () => {
    let reportNumber: string | undefined = undefined
    const { rerender, unmount } = renderHook(() => useReportTrackSeo(reportNumber))

    expect(document.title).toBe('Sanctuary | Track Rescue Case #...')

    reportNumber = 'REC-2026-9999'
    rerender()

    expect(document.title).toBe('Sanctuary | Track Rescue Case #REC-2026-9999')

    unmount()
    expect(document.title).toBe(originalTitle)
  })
})
