import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:http://localhost/mock-url'
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = () => {}
  }
}

if (typeof globalThis.caches === 'undefined') {
  globalThis.caches = {
    open: async () => ({
      match: async () => undefined,
      put: async () => {},
      delete: async () => true,
    }),
  } as unknown as CacheStorage
}

afterEach(() => {
  cleanup()
})
