import { useEffect, useState } from 'react'
import { ensurePartnerLogoCached } from '@/features/settings/domain/partnerLogo'

export function useOrgLogo(
  orgId?: string,
  logoR2Key?: string | null,
): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let currentUrl: string | null = null

    async function loadLogo() {
      if (!orgId) {
        setLogoUrl(null)
        return
      }

      const blob = await ensurePartnerLogoCached(orgId, logoR2Key ?? null)
      if (cancelled) return

      if (!blob) {
        setLogoUrl(null)
        return
      }

      const url = URL.createObjectURL(blob)
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }

      currentUrl = url
      setLogoUrl(url)
    }

    void loadLogo()

    return () => {
      cancelled = true
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
        currentUrl = null
      }
    }
  }, [orgId, logoR2Key])

  return logoUrl
}
