import { useEffect, useState } from 'react'

/**
 * Returns true if the viewport width is <= 640px (mobile breakpoint).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    if (typeof window.matchMedia !== 'function') {
      return (window.innerWidth || 0) <= 640
    }
    return (window.innerWidth || 0) <= 640 || window.matchMedia('(max-width: 640px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(max-width: 640px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
