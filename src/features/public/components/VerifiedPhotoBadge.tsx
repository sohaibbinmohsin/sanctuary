import { CircleNotch, SealCheck } from '@phosphor-icons/react'

import './VerifiedPhotoBadge.css'

/**
 * Marks a photo as taken with the in-app camera under an online, server-gated
 * capture session — not a claim of authenticity or guaranteed realness.
 */
export function VerifiedPhotoBadge({
  verified,
  pending = false,
}: {
  verified: boolean
  /** Camera capture still uploading / awaiting server verified flag. */
  pending?: boolean
}) {
  if (verified) {
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

  if (!pending) return null

  return (
    <span
      className="verified-badge verified-badge--pending"
      role="status"
      aria-label="Verifying camera photo"
      title="Confirming verified camera capture…"
    >
      <CircleNotch size={14} weight="bold" aria-hidden className="verified-badge__spin" />
      Verifying…
    </span>
  )
}
