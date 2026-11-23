import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './ResponsiveSheetModal.css'

let bodyScrollLocks = 0
let bodyOverflowBeforeLock: string | null = null

function lockPageScroll() {
  if (bodyScrollLocks === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyScrollLocks += 1
}

function unlockPageScroll() {
  bodyScrollLocks = Math.max(0, bodyScrollLocks - 1)
  if (bodyScrollLocks === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock ?? ''
    bodyOverflowBeforeLock = null
  }
}

export type ResponsiveSheetModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  closeable?: boolean
}

export function ResponsiveSheetModal({
  isOpen,
  onClose,
  title,
  children,
  closeable = true,
}: ResponsiveSheetModalProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (closeable && e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, closeable])

  useEffect(() => {
    if (!isOpen) return
    lockPageScroll()
    return () => unlockPageScroll()
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="responsive-modal-root" role="dialog" aria-modal="true">
      <div
        className="responsive-modal__backdrop"
        onClick={closeable ? onClose : undefined}
      />
      <div className="responsive-modal__card">
        <div className="responsive-modal__header">
          <h2 className="responsive-modal__title">{title}</h2>
        </div>
        <div className="responsive-modal__content">{children}</div>
      </div>
    </div>,
    document.body
  )
}
