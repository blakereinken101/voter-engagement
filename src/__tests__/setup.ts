import { vi } from 'vitest'

// Set env before any module imports
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-32chars!'
process.env.NODE_ENV = 'test'
process.env.NEXT_PHASE = 'phase-production-build'

// Global mock for next/headers (used by auth.ts synchronously)
vi.mock('next/headers', () => {
  const cookieStore = new Map<string, { name: string; value: string }>()
  const headerStore = new Map<string, string>()

  return {
    cookies: () => ({
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string, _opts?: Record<string, unknown>) => {
        cookieStore.set(name, { name, value })
      },
      delete: (name: string) => cookieStore.delete(name),
      _store: cookieStore,
    }),
    headers: () => ({
      get: (name: string) => headerStore.get(name) || null,
      _store: headerStore,
    }),
  }
})
