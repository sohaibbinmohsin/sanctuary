import type { RefObject } from 'react'

export interface LoadMoreSentinelProps {
  /**
   * Ref attached to the sentinel container observed by IntersectionObserver.
   */
  sentinelRef: RefObject<HTMLDivElement | null>

  /**
   * Whether more items remain to be loaded.
   */
  hasMore?: boolean

  /**
   * Number of remaining items in the full dataset.
   */
  remainingCount: number

  /**
   * Callback to load the next slice manually.
   */
  onLoadMore: () => void

  /**
   * Custom CSS class name for the wrapper.
   */
  className?: string

  /**
   * Custom button label text. Defaults to `Load more (${remainingCount} remaining)`.
   */
  label?: string
}

export function LoadMoreSentinel({
  sentinelRef,
  hasMore = true,
  remainingCount,
  onLoadMore,
  className,
  label,
}: LoadMoreSentinelProps) {
  if (!hasMore || remainingCount <= 0) return null

  return (
    <div
      ref={sentinelRef}
      className={className || 'load-more-sentinel'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem 0 2rem',
        gap: '0.5rem',
      }}
    >
      <button
        type="button"
        className="chip"
        onClick={onLoadMore}
        style={{ cursor: 'pointer', padding: '0.45rem 1rem' }}
      >
        {label || `Load more (${remainingCount} remaining)`}
      </button>
    </div>
  )
}
