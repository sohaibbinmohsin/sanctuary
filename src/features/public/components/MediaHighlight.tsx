import { useEffect, useId, useRef } from 'react'
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react'

export type HighlightItem = {
  url: string
  alt: string
  caption?: string
}

function isProbablyImage(url: string): boolean {
  const path = url.split('?')[0]?.toLowerCase() ?? ''
  return (
    /\.(jpe?g|png|gif|webp|avif|svg)$/.test(path) ||
    !/\.[a-z0-9]+$/i.test(path)
  )
}

type MediaHighlightProps = {
  items: HighlightItem[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

/**
 * In-page highlight for photos and ledger attachments so visitors stay on the
 * public shelter page instead of navigating away.
 */
export function MediaHighlight({
  items,
  index,
  onClose,
  onIndexChange,
}: MediaHighlightProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const onIndexChangeRef = useRef(onIndexChange)
  const item = items[index]

  onCloseRef.current = onClose
  onIndexChangeRef.current = onIndexChange

  useEffect(() => {
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (items.length <= 1) return
      if (e.key === 'ArrowLeft') {
        onIndexChangeRef.current((index - 1 + items.length) % items.length)
      }
      if (e.key === 'ArrowRight') {
        onIndexChangeRef.current((index + 1) % items.length)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length])

  if (!item) return null

  const showAsImage = isProbablyImage(item.url)

  return (
    <div
      className="ps-highlight"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => onCloseRef.current()}
    >
      <div
        className="ps-highlight__frame"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ps-highlight__toolbar">
          <p id={titleId} className="ps-highlight__caption">
            {item.caption ?? item.alt}
            {items.length > 1 ? (
              <span className="ps-highlight__count">
                {' '}
                · {index + 1} of {items.length}
              </span>
            ) : null}
          </p>
          <button
            ref={closeRef}
            type="button"
            className="ps-highlight__icon-btn"
            aria-label="Close"
            onClick={() => onCloseRef.current()}
          >
            <X size={22} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="ps-highlight__stage">
          {items.length > 1 ? (
            <button
              type="button"
              className="ps-highlight__nav ps-highlight__nav--prev"
              aria-label="Previous"
              onClick={() =>
                onIndexChangeRef.current(
                  (index - 1 + items.length) % items.length,
                )
              }
            >
              <CaretLeft size={24} weight="bold" aria-hidden />
            </button>
          ) : null}

          {showAsImage ? (
            <img
              className="ps-highlight__media"
              src={item.url}
              alt={item.alt}
            />
          ) : (
            <iframe
              className="ps-highlight__iframe"
              src={item.url}
              title={item.alt}
            />
          )}

          {items.length > 1 ? (
            <button
              type="button"
              className="ps-highlight__nav ps-highlight__nav--next"
              aria-label="Next"
              onClick={() =>
                onIndexChangeRef.current((index + 1) % items.length)
              }
            >
              <CaretRight size={24} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
