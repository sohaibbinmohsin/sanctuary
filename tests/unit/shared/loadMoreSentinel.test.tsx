import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoadMoreSentinel } from '@/shared/ui/LoadMoreSentinel'

describe('LoadMoreSentinel', () => {
  it('renders nothing when hasMore is false', () => {
    const sentinelRef = createRef<HTMLDivElement>()
    const { container } = render(
      <LoadMoreSentinel
        sentinelRef={sentinelRef}
        hasMore={false}
        remainingCount={0}
        onLoadMore={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when remainingCount is 0', () => {
    const sentinelRef = createRef<HTMLDivElement>()
    const { container } = render(
      <LoadMoreSentinel
        sentinelRef={sentinelRef}
        hasMore={true}
        remainingCount={0}
        onLoadMore={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders button with remaining count and triggers onLoadMore on click', () => {
    const sentinelRef = createRef<HTMLDivElement>()
    const onLoadMore = vi.fn()

    render(
      <LoadMoreSentinel
        sentinelRef={sentinelRef}
        hasMore={true}
        remainingCount={42}
        onLoadMore={onLoadMore}
      />,
    )

    const btn = screen.getByRole('button', { name: /load more \(42 remaining\)/i })
    expect(btn).toBeInTheDocument()

    fireEvent.click(btn)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('supports custom label and className', () => {
    const sentinelRef = createRef<HTMLDivElement>()
    const onLoadMore = vi.fn()

    const { container } = render(
      <LoadMoreSentinel
        sentinelRef={sentinelRef}
        hasMore={true}
        remainingCount={10}
        onLoadMore={onLoadMore}
        className="custom-sentinel-class"
        label="Show next 50 entries"
      />,
    )

    expect(screen.getByRole('button', { name: 'Show next 50 entries' })).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('custom-sentinel-class')
  })
})
