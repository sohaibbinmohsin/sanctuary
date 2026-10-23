/**
 * Scroll management utilities across mobile (window) and desktop (.app-shell__body).
 */

export function getAppScrollTop(): number {
  if (typeof document === 'undefined') return 0
  const shellBody = document.querySelector('.app-shell__body')
  if (shellBody && shellBody.scrollTop > 0) {
    return shellBody.scrollTop
  }
  return window.scrollY || document.documentElement.scrollTop || 0
}

export function setAppScrollTop(top: number): void {
  if (typeof document === 'undefined') return
  const shellBody = document.querySelector('.app-shell__body')
  if (shellBody) {
    if (typeof shellBody.scrollTo === 'function') {
      shellBody.scrollTo({ top, behavior: 'instant' as ScrollBehavior })
    } else {
      shellBody.scrollTop = top
    }
  }
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top, behavior: 'instant' as ScrollBehavior })
  }
}

const ANIMALS_SCROLL_KEY = 'sanctuary:scroll:/animals'
const LAST_ANIMAL_ID_KEY = 'sanctuary:scroll:last_animal_id'

export function saveAnimalsScrollPosition(animalId?: string): void {
  try {
    const top = getAppScrollTop()
    if (top > 0) {
      sessionStorage.setItem(ANIMALS_SCROLL_KEY, String(top))
    }
    if (animalId) {
      sessionStorage.setItem(LAST_ANIMAL_ID_KEY, animalId)
    }
  } catch {
    /* ignore session storage restrictions */
  }
}

export function getAnimalsScrollPosition(): number | null {
  try {
    const saved = sessionStorage.getItem(ANIMALS_SCROLL_KEY)
    if (!saved) return null
    const top = Number(saved)
    return Number.isFinite(top) ? top : null
  } catch {
    return null
  }
}

export function getLastClickedAnimalId(): string | null {
  try {
    return sessionStorage.getItem(LAST_ANIMAL_ID_KEY)
  } catch {
    return null
  }
}

export function clearAnimalsScrollPosition(): void {
  try {
    sessionStorage.removeItem(ANIMALS_SCROLL_KEY)
    sessionStorage.removeItem(LAST_ANIMAL_ID_KEY)
  } catch {
    /* ignore */
  }
}
