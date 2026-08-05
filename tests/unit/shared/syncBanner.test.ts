import { describe, it, expect } from 'vitest'
import { CLOUD_UNREACHABLE_MESSAGE } from '@/shared/ui/SyncBanner'

describe('support copy', () => {
  it('uses exact cloud unreachable sentence', () => {
    expect(CLOUD_UNREACHABLE_MESSAGE).toBe(
      "Can't reach Sanctuary cloud right now. Your data is safe on this phone. Please contact support.",
    )
  })
})
