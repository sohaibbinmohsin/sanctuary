import { describe, expect, it } from 'vitest'
import {
  CLOUD_UNREACHABLE_MESSAGE,
  pendingSyncMessage,
} from '@/shared/ui/SyncBanner'

describe('SyncBanner copy', () => {
  it('keeps a plain-language offline failure message', () => {
    expect(CLOUD_UNREACHABLE_MESSAGE).toBe(
      "Can't reach Sanctuary right now. Your data is safe on this phone. Please contact support.",
    )
  })

  it('says loading while records are still downloading', () => {
    expect(
      pendingSyncMessage({
        hasSynced: true,
        downloading: true,
        uploading: false,
      }),
    ).toBe('Loading your records…')
  })

  it('says saving only when local changes are uploading', () => {
    expect(
      pendingSyncMessage({
        hasSynced: true,
        downloading: false,
        uploading: true,
      }),
    ).toBe('Saving your updates…')
  })
})
