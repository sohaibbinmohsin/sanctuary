import { useEffect, useId, useRef } from 'react'
import { SealCheck } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/Button'

type VerifiedExplainDialogProps = {
  onClose: () => void
}

/**
 * Explains what the public “verified” seal means for in-app camera photos.
 */
export function VerifiedExplainDialog({ onClose }: VerifiedExplainDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="confirm-root" role="presentation">
      <button
        type="button"
        className="confirm-backdrop"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <div className="confirm-card__icon confirm-card__icon--default">
          <SealCheck size={28} weight="duotone" aria-hidden />
        </div>
        <h2 id={titleId} className="confirm-card__title">
          Verified photo
        </h2>
        <p id={bodyId} className="confirm-card__body">
          This mark means at least one photo was taken with Sanctuary’s in-app
          camera while the team was online. It records how the photo was
          captured. It is not a guarantee about everything else in the picture.
        </p>
        <div className="confirm-card__actions confirm-card__actions--stack">
          <Button
            ref={closeRef}
            type="button"
            variant="primary"
            block
            onClick={onClose}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
