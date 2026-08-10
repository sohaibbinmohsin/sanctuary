import { SealCheck } from '@phosphor-icons/react'

import './VerifiedPhotoBadge.css'

/**
 * Marks a photo as taken with the in-app camera under an online, server-gated
 * capture session — not a claim of authenticity or guaranteed realness.
 * Minimal today; Phase B adds richer verification detail (who/when).
 */
export function VerifiedPhotoBadge({ verified }: { verified: boolean }) {
  if (!verified) return null

  return (
    <span
      className="verified-badge"
      role="img"
      aria-label="Verified in-app camera photo"
      title="Taken with the in-app camera during an online session"
    >
      <SealCheck size={14} weight="fill" aria-hidden />
      Verified
    </span>
  )
}
