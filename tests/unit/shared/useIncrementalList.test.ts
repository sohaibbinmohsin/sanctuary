import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIncrementalList } from '@/shared/hooks/useIncrementalList'

describe('useIncrementalList', () => {
  const generateItems = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Item ${i + 1}`,
    }))

  it('slices items to default batchSize (50) initially', () => {
    const items = generateItems(120)
    const { result } = renderHook(() => useIncrementalList(items, { batchSize: 50 }))

    expect(result.current.visibleItems).toHaveLength(50)
    expect(result.current.visibleItems[0].id).toBe('item-1')
    expect(result.current.visibleItems[49].id).toBe('item-50')
    expect(result.current.hasMore).toBe(true)
    expect(result.current.remainingCount).toBe(70)
  })

  it('handles items smaller than batchSize', () => {
    const items = generateItems(15)
    const { result } = renderHook(() => useIncrementalList(items, { batchSize: 50 }))

    expect(result.current.visibleItems).toHaveLength(15)
    expect(result.current.hasMore).toBe(false)
    expect(result.current.remainingCount).toBe(0)
  })

  it('increments slice when loadMore is called', () => {
    const items = generateItems(120)
    const { result } = renderHook(() => useIncrementalList(items, { batchSize: 50 }))

    act(() => {
      result.current.loadMore()
    })

    expect(result.current.visibleItems).toHaveLength(100)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.remainingCount).toBe(20)

    act(() => {
      result.current.loadMore()
    })

    expect(result.current.visibleItems).toHaveLength(120)
    expect(result.current.hasMore).toBe(false)
    expect(result.current.remainingCount).toBe(0)
  })

  it('auto-expands batch to include targetId for scroll restoration', () => {
    const items = generateItems(150)
    // Target item is at index 84 (batch 2 if batch size is 50)
    const targetId = 'item-85'

    const { result } = renderHook(() =>
      useIncrementalList(items, {
        batchSize: 50,
        targetId,
        getId: (i) => i.id,
      }),
    )

    // Should expand so item-85 is visible
    expect(result.current.visibleItems.length).toBeGreaterThanOrEqual(85)
    expect(result.current.visibleItems.some((i) => i.id === targetId)).toBe(true)
  })

  it('resets display limit when resetDeps change', () => {
    const items = generateItems(120)
    let query = 'cat'

    const { result, rerender } = renderHook(() =>
      useIncrementalList(items, {
        batchSize: 50,
        resetDeps: [query],
      }),
    )

    act(() => {
      result.current.loadMore()
    })
    expect(result.current.visibleItems).toHaveLength(100)

    // Query changes
    query = 'dog'
    rerender()

    expect(result.current.visibleItems).toHaveLength(50)
  })
})
