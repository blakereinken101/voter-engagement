import { describe, it, expect } from 'vitest'
import { sanitizeSlug, validateSlug, RESERVED_SLUGS } from '../slugs'

describe('sanitizeSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(sanitizeSlug('My Campaign')).toBe('my-campaign')
  })

  it('removes special characters', () => {
    expect(sanitizeSlug("Bob's Team!")).toBe('bobs-team')
  })

  it('collapses multiple hyphens', () => {
    expect(sanitizeSlug('a---b')).toBe('a-b')
  })

  it('trims leading/trailing hyphens', () => {
    expect(sanitizeSlug('-hello-')).toBe('hello')
  })

  it('truncates to 50 characters', () => {
    const long = 'a'.repeat(60)
    expect(sanitizeSlug(long).length).toBe(50)
  })

  it('handles whitespace-only input', () => {
    expect(sanitizeSlug('   ')).toBe('')
  })
})

describe('validateSlug', () => {
  it('accepts valid slug', () => {
    expect(validateSlug('my-campaign')).toEqual({ valid: true })
  })

  it('rejects too short (< 3 chars)', () => {
    const result = validateSlug('ab')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 3')
  })

  it('rejects too long (> 50 chars)', () => {
    const result = validateSlug('a'.repeat(51))
    expect(result.valid).toBe(false)
    expect(result.error).toContain('50 characters')
  })

  it('rejects reserved slugs', () => {
    for (const slug of ['events', 'dashboard', 'api']) {
      expect(validateSlug(slug).valid).toBe(false)
    }
  })

  it('rejects slugs with invalid characters', () => {
    const result = validateSlug('my_campaign')
    expect(result.valid).toBe(false)
  })
})
