import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOrgLogo } from '@/shared/hooks/useOrgLogo'
import * as partnerLogoModule from '@/features/settings/domain/partnerLogo'

describe('useOrgLogo', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when orgId is undefined', () => {
    const { result } = renderHook(() => useOrgLogo(undefined, null))
    expect(result.current).toBeNull()
  })

  it('fetches and converts cached blob to object URL', async () => {
    const fakeBlob = new Blob(['fake image content'], { type: 'image/png' })
    vi.spyOn(partnerLogoModule, 'ensurePartnerLogoCached').mockResolvedValue(fakeBlob)

    const createObjectUrlMock = vi.fn().mockReturnValue('blob:http://localhost/test-org-logo')
    const revokeObjectUrlMock = vi.fn()
    window.URL.createObjectURL = createObjectUrlMock
    window.URL.revokeObjectURL = revokeObjectUrlMock

    const { result, unmount } = renderHook(() => useOrgLogo('org-123', 'key-123'))

    await waitFor(() => {
      expect(result.current).toBe('blob:http://localhost/test-org-logo')
    })
    expect(partnerLogoModule.ensurePartnerLogoCached).toHaveBeenCalledWith('org-123', 'key-123')

    unmount()
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:http://localhost/test-org-logo')
  })
})
