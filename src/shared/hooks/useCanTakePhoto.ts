import { useEffect, useState } from 'react'

/**
 * HTML file inputs with `capture` are honored on phones/tablets.
 * Desktop browsers ignore `capture` and open a plain file picker.
 */
export function supportsCameraCapture(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false
  }
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true
  // iPadOS 13+ can report as Macintosh — treat coarse touch as mobile.
  if (
    navigator.maxTouchPoints > 1 &&
    window.matchMedia('(hover: hover)').matches === false
  ) {
    return true
  }
  return false
}

async function hasVideoInputDevice(): Promise<boolean | null> {
  if (!navigator.mediaDevices?.enumerateDevices) return null
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.some((d) => d.kind === 'videoinput')
  } catch {
    return null
  }
}

/**
 * True when "Take photo" should be offered (camera capture, not a file picker).
 * False on desktop and when no camera device is present.
 */
export function useCanTakePhoto(): boolean {
  const [canTake, setCanTake] = useState(() => supportsCameraCapture())

  useEffect(() => {
    if (!supportsCameraCapture()) {
      setCanTake(false)
      return
    }

    let cancelled = false
    void hasVideoInputDevice().then((hasCam) => {
      if (cancelled) return
      // If enumeration is unavailable before permission, still offer
      // Take photo on mobile — capture will prompt for camera access.
      setCanTake(hasCam !== false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return canTake
}
