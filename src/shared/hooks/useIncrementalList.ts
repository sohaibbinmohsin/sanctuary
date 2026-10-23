import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface UseIncrementalListOptions<T> {
  /**
   * Number of items to display initially and add with each batch.
   * Defaults to 50.
   */
  batchSize?: number

  /**
   * IntersectionObserver rootMargin (e.g. '400px').
   * Allows pre-fetching/pre-rendering the next slice before the user scrolls to the absolute bottom.
   * Defaults to '400px'.
   */
  rootMargin?: string

  /**
   * If provided, auto-expands the display limit so this item is included
   * in the visible slice. Crucial for scroll restoration when returning from a detail view.
   */
  targetId?: string | null

  /**
   * Function to extract the unique ID of an item for targetId matching.
   * Defaults to item => (item as Record<string, unknown>)?.id as string.
   */
  getId?: (item: T) => string | undefined

  /**
   * Optional dependencies array that, when any dependency changes,
   * resets the display limit back to batchSize (e.g. when search query or filter changes).
   */
  resetDeps?: unknown[]
}

export interface UseIncrementalListResult<T> {
  /**
   * The sliced list of items currently visible in the DOM.
   */
  visibleItems: T[]

  /**
   * Whether there are more items beyond the visible slice.
   */
  hasMore: boolean

  /**
   * Number of items remaining beyond the current slice.
   */
  remainingCount: number

  /**
   * Current number of items allowed to be displayed.
   */
  displayLimit: number

  /**
   * Manually load the next batch of items.
   */
  loadMore: () => void

  /**
   * Ref to attach to the sentinel element at the bottom of the list.
   */
  sentinelRef: React.RefObject<HTMLDivElement | null>

  /**
   * Set display limit directly if needed.
   */
  setDisplayLimit: React.Dispatch<React.SetStateAction<number>>
}

const DEFAULT_BATCH_SIZE = 50
const DEFAULT_ROOT_MARGIN = '400px'

export function useIncrementalList<T>(
  items: T[],
  options?: UseIncrementalListOptions<T>,
): UseIncrementalListResult<T> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
  const rootMargin = options?.rootMargin ?? DEFAULT_ROOT_MARGIN
  const targetId = options?.targetId
  const getId = options?.getId ?? ((item: T) => (item as Record<string, unknown>)?.id as string | undefined)
  const resetDeps = options?.resetDeps

  const [displayLimit, setDisplayLimit] = useState<number>(batchSize)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Reset limit when filter/search dependencies change
  const prevResetDeps = useRef(resetDeps)
  useEffect(() => {
    if (!resetDeps) return
    const prev = prevResetDeps.current
    const changed =
      !prev ||
      prev.length !== resetDeps.length ||
      prev.some((dep, i) => !Object.is(dep, resetDeps[i]))
    if (changed) {
      prevResetDeps.current = resetDeps
      setDisplayLimit(batchSize)
    }
  }, [resetDeps, batchSize])

  // Auto-expand display limit if targetId is specified and beyond current batch
  useEffect(() => {
    if (!targetId || items.length === 0) return
    const targetIndex = items.findIndex((item) => getId(item) === targetId)
    if (targetIndex >= 0 && targetIndex >= displayLimit) {
      const needed = Math.min(
        items.length,
        Math.ceil((targetIndex + 10) / batchSize) * batchSize,
      )
      setDisplayLimit((prev) => Math.max(prev, needed))
    }
  }, [items, targetId, getId, batchSize, displayLimit])

  // Visible items slice
  const visibleItems = useMemo(() => {
    return items.slice(0, displayLimit)
  }, [items, displayLimit])

  const hasMore = visibleItems.length < items.length
  const remainingCount = Math.max(0, items.length - visibleItems.length)

  const loadMore = useCallback(() => {
    setDisplayLimit((prev) => Math.min(items.length, prev + batchSize))
  }, [items.length, batchSize])

  // IntersectionObserver to auto-load more as sentinel comes near viewport
  useEffect(() => {
    if (!hasMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayLimit((prev) => Math.min(items.length, prev + batchSize))
        }
      },
      { rootMargin },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, items.length, batchSize, rootMargin])

  return {
    visibleItems,
    hasMore,
    remainingCount,
    displayLimit,
    loadMore,
    sentinelRef,
    setDisplayLimit,
  }
}
