/**
 * Lightweight in-process cache using Map + TTL.
 * Same pattern as campaign-config.server.ts, extracted for reuse.
 * No external dependencies. Safe for single-process Node deployments.
 */

export interface ProcessCache<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
  invalidate(key?: string): void
}

export function createCache<T>(ttlMs: number): ProcessCache<T> {
  const store = new Map<string, { value: T; timestamp: number }>()

  return {
    get(key: string): T | undefined {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() - entry.timestamp > ttlMs) {
        store.delete(key)
        return undefined
      }
      return entry.value
    },

    set(key: string, value: T): void {
      store.set(key, { value, timestamp: Date.now() })
    },

    invalidate(key?: string): void {
      if (key) store.delete(key)
      else store.clear()
    },
  }
}
