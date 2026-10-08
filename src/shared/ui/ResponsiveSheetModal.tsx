import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './ResponsiveSheetModal.css'

export type ResponsiveSheetModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function ResponsiveSheetModal({
  isOpen,
  onClose,
  title,
  children,
}: ResponsiveSheetModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="responsive-modal-root" role="dialog" aria-modal="true">
      <div className="responsive-modal__backdrop" onClick={onClose} />
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
