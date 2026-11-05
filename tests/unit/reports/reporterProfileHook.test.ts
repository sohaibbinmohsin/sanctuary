import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReporterProfile, REPORTER_PROFILE_KEY } from '@/features/reports/hooks/useReporterProfile'

describe('useReporterProfile', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores and restores reporter contact details', () => {
    const { result } = renderHook(() => useReporterProfile())
    expect(result.current.profile).toBeNull()

    act(() => {
      result.current.saveProfile({
        name: 'Usman Ali',
        phone: '0300 1234567',
        cnic: '42101-1234567-1',
        city: 'Lahore',
      })
    })

    expect(result.current.profile?.name).toBe('Usman Ali')
    const stored = JSON.parse(localStorage.getItem(REPORTER_PROFILE_KEY) || '{}')
    expect(stored.phone).toBe('0300 1234567')
  })
})
