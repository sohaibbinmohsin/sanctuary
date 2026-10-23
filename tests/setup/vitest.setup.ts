import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

vi.mock('@/shared/lib/supabase', () => {
  const createChain = (): any => {
    const chain: any = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (resolve: any, reject?: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
    }
    return chain
  }

  return {
    supabaseConfigured: true,
    supabase: {
      from: vi.fn(() => createChain()),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    },
    getSupportEmail: () => 'support@themohsinproject.org',
  }
})

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
