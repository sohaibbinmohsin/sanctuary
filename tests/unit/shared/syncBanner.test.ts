import { describe, expect, it } from 'vitest'
import { CLOUD_UNREACHABLE_MESSAGE } from '@/shared/ui/SyncBanner'

describe('SyncBanner copy', () => {
  it('keeps a plain-language offline failure message', () => {
    expect(CLOUD_UNREACHABLE_MESSAGE).toBe(
      "Can't reach Sanctuary right now. Your data is safe on this phone. Please contact support.",
    )
  })
})
