import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCache } from '../cache'

describe('createCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves a value', () => {
    const cache = createCache<string>(1000)
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('returns undefined for missing key', () => {
    const cache = createCache<string>(1000)
    expect(cache.get('nonexistent')).toBeUndefined()
  })

  it('expires entries after TTL', () => {
    const cache = createCache<string>(100)
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')

    vi.advanceTimersByTime(150)
    expect(cache.get('key')).toBeUndefined()
  })

  it('does not expire entries before TTL', () => {
    const cache = createCache<string>(1000)
    cache.set('key', 'value')

    vi.advanceTimersByTime(500)
    expect(cache.get('key')).toBe('value')
  })

  it('invalidates a specific key', () => {
    const cache = createCache<string>(10000)
    cache.set('a', '1')
    cache.set('b', '2')

    cache.invalidate('a')
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe('2')
  })

  it('invalidates all keys when called without argument', () => {
    const cache = createCache<string>(10000)
    cache.set('a', '1')
    cache.set('b', '2')

    cache.invalidate()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('overwrites existing key with new value and resets TTL', () => {
    const cache = createCache<string>(200)
    cache.set('key', 'first')

    vi.advanceTimersByTime(150)
    cache.set('key', 'second')

    vi.advanceTimersByTime(100)
    expect(cache.get('key')).toBe('second')
  })
})
