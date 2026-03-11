import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  normalizeCity,
  expandNicknames,
  ageRangeToYears,
  birthYearInRange,
  matchPeopleToVoterFile,
} from '../matching'
import type { VoterRecord, PersonEntry } from '@/types'

// ── Helpers ──────────────────────────────────────────────

function makeVoter(overrides: Partial<VoterRecord> = {}): VoterRecord {
  return {
    voter_id: crypto.randomUUID(),
    first_name: 'Jane',
    last_name: 'Doe',
    date_of_birth: '1985-01-01',
    gender: 'F',
    residential_address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    party_affiliation: 'DEM',
    registration_date: '2020-01-01',
    voter_status: 'Active',
    VH2024G: 'Y', VH2022G: 'Y', VH2020G: 'Y',
    VH2024P: '', VH2022P: '', VH2020P: '',
    ...overrides,
  }
}

function makePerson(overrides: Partial<PersonEntry> = {}): PersonEntry {
  return {
    id: crypto.randomUUID(),
    firstName: 'Jane',
    lastName: 'Doe',
    category: 'close-friends',
    ...overrides,
  }
}

// ── Pure function tests ──────────────────────────────────

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  John  ')).toBe('john')
  })

  it('preserves apostrophes and hyphens', () => {
    expect(normalizeName("O'Brien")).toBe("o'brien")
    expect(normalizeName('Jean-Pierre')).toBe('jean-pierre')
  })

  it('strips non-alpha characters except hyphens and apostrophes', () => {
    expect(normalizeName('John123')).toBe('john')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeName('Mary  Jane')).toBe('mary jane')
  })

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('')
  })
})

describe('normalizeCity', () => {
  it('lowercases, trims, and collapses spaces', () => {
    expect(normalizeCity('  New   York  ')).toBe('new york')
  })

  it('handles single-word city', () => {
    expect(normalizeCity('BOSTON')).toBe('boston')
  })
})

describe('expandNicknames', () => {
  it('expands nickname to formal name', () => {
    const result = expandNicknames('Bob')
    expect(result).toContain('bob')
    expect(result).toContain('robert')
  })

  it('expands formal name to nicknames (reverse lookup)', () => {
    const result = expandNicknames('Robert')
    expect(result).toContain('robert')
    expect(result).toContain('bob')
    expect(result).toContain('rob')
    expect(result).toContain('robbie')
  })

  it('returns self for unknown names', () => {
    const result = expandNicknames('Xenophon')
    expect(result).toEqual(['xenophon'])
  })

  it('expands beth to elizabeth', () => {
    const result = expandNicknames('Beth')
    expect(result).toContain('beth')
    expect(result).toContain('elizabeth')
  })

  it('deduplicates entries', () => {
    const result = expandNicknames('Bob')
    const unique = new Set(result)
    expect(result.length).toBe(unique.size)
  })
})

describe('ageRangeToYears', () => {
  const currentYear = new Date().getFullYear()

  it('converts 25-34 range', () => {
    const { min, max } = ageRangeToYears('25-34')
    expect(min).toBe(currentYear - 34)
    expect(max).toBe(currentYear - 25)
  })

  it('converts 65+ range', () => {
    const { min, max } = ageRangeToYears('65+')
    expect(min).toBe(1900)
    expect(max).toBe(currentYear - 65)
  })

  it('converts under-25 range', () => {
    const { min, max } = ageRangeToYears('under-25')
    expect(min).toBe(currentYear - 24)
    expect(max).toBe(currentYear - 18)
  })

  it('returns full range for unknown input', () => {
    const { min, max } = ageRangeToYears('unknown')
    expect(min).toBe(1900)
    expect(max).toBe(currentYear)
  })
})

describe('birthYearInRange', () => {
  it('returns true when birth year is in range', () => {
    const currentYear = new Date().getFullYear()
    const dob = `${currentYear - 30}-06-15`
    expect(birthYearInRange(dob, '25-34')).toBe(true)
  })

  it('returns false when birth year is out of range', () => {
    expect(birthYearInRange('1940-06-15', '25-34')).toBe(false)
  })

  it('handles 65+ range', () => {
    expect(birthYearInRange('1940-06-15', '65+')).toBe(true)
  })
})

// ── In-memory matching integration tests ─────────────────

describe('matchPeopleToVoterFile', () => {
  it('returns empty array for empty inputs', async () => {
    const results = await matchPeopleToVoterFile([], [])
    expect(results).toEqual([])
  })

  it('returns unmatched when voter file is empty', async () => {
    const people = [makePerson({ firstName: 'John', lastName: 'Smith' })]
    const results = await matchPeopleToVoterFile(people, [])
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('unmatched')
    expect(results[0].candidates).toHaveLength(0)
  })

  it('finds exact name match with high confidence', async () => {
    const voter = makeVoter({ first_name: 'John', last_name: 'Smith' })
    const person = makePerson({ firstName: 'John', lastName: 'Smith' })

    const results = await matchPeopleToVoterFile([person], [voter])
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('ambiguous') // all matches need review
    expect(results[0].candidates.length).toBeGreaterThan(0)
    expect(results[0].candidates[0].score).toBeGreaterThanOrEqual(0.9)
    expect(results[0].candidates[0].matchedOn).toContain('exact-name')
  })

  it('matches nickname (Bob -> Robert)', async () => {
    const voter = makeVoter({ first_name: 'Robert', last_name: 'Johnson' })
    const person = makePerson({ firstName: 'Bob', lastName: 'Johnson' })

    const results = await matchPeopleToVoterFile([person], [voter])
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('ambiguous')
    expect(results[0].candidates.length).toBeGreaterThan(0)
    expect(results[0].candidates[0].matchedOn).toContain('exact-name')
  })

  it('matches phonetic variants (Kaitlyn/Caitlin)', async () => {
    const voter = makeVoter({ first_name: 'Caitlin', last_name: 'Smith' })
    const person = makePerson({ firstName: 'Kaitlyn', lastName: 'Smith' })

    const results = await matchPeopleToVoterFile([person], [voter])
    expect(results).toHaveLength(1)
    // Should find match via exact-name (same last name) or phonetic
    expect(results[0].candidates.length).toBeGreaterThan(0)
    expect(results[0].candidates[0].score).toBeGreaterThanOrEqual(0.55)
  })

  it('returns unmatched for completely different names', async () => {
    const voter = makeVoter({ first_name: 'John', last_name: 'Smith' })
    const person = makePerson({ firstName: 'Zzzzzz', lastName: 'Qqqqqqq' })

    const results = await matchPeopleToVoterFile([person], [voter])
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('unmatched')
  })

  it('boosts score for matching zip code', async () => {
    const voter1 = makeVoter({ first_name: 'John', last_name: 'Smith', zip: '10001' })
    const voter2 = makeVoter({ first_name: 'John', last_name: 'Smith', zip: '99999' })
    const person = makePerson({ firstName: 'John', lastName: 'Smith', zip: '10001' })

    const results = await matchPeopleToVoterFile([person], [voter1, voter2])
    expect(results).toHaveLength(1)

    const candidates = results[0].candidates
    const withZip = candidates.find(c => c.voterRecord.zip === '10001')
    const withoutZip = candidates.find(c => c.voterRecord.zip === '99999')

    if (withZip && withoutZip) {
      expect(withZip.score).toBeGreaterThanOrEqual(withoutZip.score)
    }
  })

  it('penalizes gender mismatch', async () => {
    const voterMatch = makeVoter({ first_name: 'Pat', last_name: 'Jones', gender: 'F' })
    const voterMismatch = makeVoter({ first_name: 'Pat', last_name: 'Jones', gender: 'M' })
    const person = makePerson({ firstName: 'Pat', lastName: 'Jones', gender: 'F' })

    const results = await matchPeopleToVoterFile([person], [voterMatch, voterMismatch])
    const candidates = results[0].candidates
    const female = candidates.find(c => c.voterRecord.gender === 'F')
    const male = candidates.find(c => c.voterRecord.gender === 'M')

    if (female && male) {
      expect(female.score).toBeGreaterThan(male.score)
    }
  })

  it('handles multiple people against same voter file', async () => {
    const voters = [
      makeVoter({ first_name: 'Alice', last_name: 'Adams' }),
      makeVoter({ first_name: 'Bob', last_name: 'Baker' }),
    ]
    const people = [
      makePerson({ firstName: 'Alice', lastName: 'Adams' }),
      makePerson({ firstName: 'Bob', lastName: 'Baker' }),
      makePerson({ firstName: 'Charlie', lastName: 'Xxxxxxx' }),
    ]

    const results = await matchPeopleToVoterFile(people, voters)
    expect(results).toHaveLength(3)

    // Alice and Bob should match
    expect(results[0].candidates.length).toBeGreaterThan(0)
    expect(results[1].candidates.length).toBeGreaterThan(0)
    // Charlie should not
    expect(results[2].status).toBe('unmatched')
  })

  it('sanitizes voter records (strips voter_id and full DOB)', async () => {
    const voter = makeVoter({ first_name: 'Test', last_name: 'User', date_of_birth: '1990-05-15' })
    const person = makePerson({ firstName: 'Test', lastName: 'User' })

    const results = await matchPeopleToVoterFile([person], [voter])
    const record = results[0].candidates[0]?.voterRecord

    if (record) {
      expect(record).not.toHaveProperty('voter_id')
      expect(record).not.toHaveProperty('date_of_birth')
      expect(record).toHaveProperty('birth_year', '1990')
    }
  })

  it('sets voteScore and segment for matches above cutoff', async () => {
    const voter = makeVoter({
      first_name: 'John',
      last_name: 'Smith',
      VH2024G: 'Y', VH2022G: 'Y', VH2020G: 'Y',
      VH2024P: 'Y', VH2022P: 'Y', VH2020P: 'Y',
    })
    const person = makePerson({ firstName: 'John', lastName: 'Smith' })

    const results = await matchPeopleToVoterFile([person], [voter])
    expect(results[0].voteScore).toBe(1.0)
    expect(results[0].segment).toBe('super-voter')
  })
})
