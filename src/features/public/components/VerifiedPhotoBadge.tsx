import { SealCheck } from '@phosphor-icons/react'

/**
 * Marks a photo as staff-verified. Minimal today; Phase B adds richer
 * verification detail (who/when).
 */
export function VerifiedPhotoBadge({ verified }: { verified: boolean }) {
  if (!verified) return null

  return (
    <span className="verified-badge" title="Verified by shelter staff">
      <SealCheck size={14} weight="fill" aria-hidden />
      Verified
    </span>
  )
}
