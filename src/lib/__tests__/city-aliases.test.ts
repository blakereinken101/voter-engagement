import { describe, it, expect } from 'vitest'
import { getCityMatchScore, citiesMatch, getMetroArea } from '../city-aliases'

describe('getMetroArea', () => {
  it('resolves known metro', () => {
    expect(getMetroArea('new york')).toBe('new york')
  })

  it('resolves neighborhood to metro', () => {
    expect(getMetroArea('queens')).toBe('new york')
    expect(getMetroArea('forest hills')).toBe('new york')
  })

  it('resolves via zip prefix fallback', () => {
    expect(getMetroArea('unknown-city', '10001')).toBe('new york')
  })

  it('returns null for unknown city and zip', () => {
    expect(getMetroArea('smallville', '99999')).toBeNull()
  })
})

describe('citiesMatch', () => {
  it('matches neighborhoods in same metro', () => {
    expect(citiesMatch('queens', 'brooklyn')).toBe(true)
  })

  it('matches neighborhood to metro name', () => {
    expect(citiesMatch('queens', 'new york')).toBe(true)
  })

  it('does not match different metros', () => {
    expect(citiesMatch('queens', 'boston')).toBe(false)
  })

  it('matches exact city names outside alias table', () => {
    expect(citiesMatch('Smallville', 'smallville')).toBe(true)
  })
})

describe('getCityMatchScore', () => {
  it('returns 1.0 for exact match', () => {
    expect(getCityMatchScore('new york', 'new york')).toBe(1.0)
  })

  it('returns 0.95 for same metro via alias', () => {
    expect(getCityMatchScore('queens', 'brooklyn')).toBe(0.95)
  })

  it('returns 0.95 for neighborhood to metro', () => {
    expect(getCityMatchScore('queens', 'new york')).toBe(0.95)
  })

  it('returns 0.85 for same zip prefix with metro mapping', () => {
    expect(getCityMatchScore('place-a', 'place-b', '10001', '10099')).toBe(0.85)
  })

  it('returns 0.5 for same zip prefix without metro mapping', () => {
    expect(getCityMatchScore('place-a', 'place-b', '55501', '55502')).toBe(0.5)
  })

  it('returns 0.0 for completely unrelated cities', () => {
    expect(getCityMatchScore('springfield', 'shelbyville', '99901', '88801')).toBe(0.0)
  })

  it('returns 0.85 for exact zip match even with different city names', () => {
    expect(getCityMatchScore('townA', 'townB', '30301', '30301')).toBe(0.85)
  })
})
