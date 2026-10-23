import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAppScrollTop,
  setAppScrollTop,
  saveAnimalsScrollPosition,
  getAnimalsScrollPosition,
  getLastClickedAnimalId,
  clearAnimalsScrollPosition,
} from '@/shared/lib/scroll'

describe('scroll utilities', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('saves, retrieves, and clears animals scroll position and animal id', () => {
    expect(getAnimalsScrollPosition()).toBeNull()
    expect(getLastClickedAnimalId()).toBeNull()

    // Mock window scroll
    Object.defineProperty(window, 'scrollY', { value: 340, writable: true })
    expect(getAppScrollTop()).toBe(340)
    saveAnimalsScrollPosition('anim-61')

    expect(getAnimalsScrollPosition()).toBe(340)
    expect(getLastClickedAnimalId()).toBe('anim-61')

    clearAnimalsScrollPosition()
    expect(getAnimalsScrollPosition()).toBeNull()
    expect(getLastClickedAnimalId()).toBeNull()
  })

  it('sets scroll position on window and app-shell__body if present', () => {
    const windowScrollTo = vi.fn()
    window.scrollTo = windowScrollTo

    const mockBody = document.createElement('div')
    mockBody.className = 'app-shell__body'
    const bodyScrollTo = vi.fn()
    mockBody.scrollTo = bodyScrollTo
    document.body.appendChild(mockBody)

    setAppScrollTop(150)

    expect(windowScrollTo).toHaveBeenCalledWith({ top: 150, behavior: 'instant' })
    expect(bodyScrollTo).toHaveBeenCalledWith({ top: 150, behavior: 'instant' })

    document.body.removeChild(mockBody)
  })
})
