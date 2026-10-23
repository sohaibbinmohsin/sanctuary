import { useState, useCallback } from 'react'

export const REPORTER_PROFILE_KEY = 'sanctuary_reporter_profile_v1'

export type ReporterProfile = {
  name: string
  phone: string
  cnic: string
  city: string
}

export function useReporterProfile() {
  const [profile, setProfile] = useState<ReporterProfile | null>(() => {
    try {
      const saved = localStorage.getItem(REPORTER_PROFILE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return null
  })

  const saveProfile = useCallback((data: ReporterProfile) => {
    setProfile(data)
    try {
      localStorage.setItem(REPORTER_PROFILE_KEY, JSON.stringify(data))
    } catch {}
  }, [])

  const clearProfile = useCallback(() => {
    setProfile(null)
    try {
      localStorage.removeItem(REPORTER_PROFILE_KEY)
    } catch {}
  }, [])

  return { profile, saveProfile, clearProfile }
}
