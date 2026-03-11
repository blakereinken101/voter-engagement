import { describe, it, expect } from 'vitest'
import { calculateVoteScore, determineSegment, isInTargetUniverse, getVoteHistoryDetail } from '../voter-segments'
import type { SafeVoterRecord, VoterRecord, TargetUniverseConfig } from '@/types'

function makeRecord(overrides: Partial<SafeVoterRecord> = {}): SafeVoterRecord {
  return {
    first_name: 'Jane',
    last_name: 'Doe',
    gender: 'F',
    residential_address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    party_affiliation: 'DEM',
    registration_date: '2020-01-01',
    voter_status: 'Active',
    VH2024G: '',
    VH2022G: '',
    VH2020G: '',
    VH2024P: '',
    VH2022P: '',
    VH2020P: '',
    ...overrides,
  }
}

describe('calculateVoteScore', () => {
  it('returns 1.0 when all elections voted', () => {
    const record = makeRecord({
      VH2024G: 'Y', VH2022G: 'Y', VH2020G: 'Y',
      VH2024P: 'Y', VH2022P: 'Y', VH2020P: 'Y',
    })
    expect(calculateVoteScore(record)).toBe(1.0)
  })

  it('returns 0 when no elections voted', () => {
    const record = makeRecord()
    expect(calculateVoteScore(record)).toBe(0)
  })

  it('returns 0.5 when 3 of 6 elections voted', () => {
    const record = makeRecord({
      VH2024G: 'Y', VH2022G: 'A', VH2020G: 'E',
    })
    expect(calculateVoteScore(record)).toBe(0.5)
  })

  it('counts absentee (A) and early (E) as voted', () => {
    const record = makeRecord({ VH2024G: 'A', VH2022G: 'E' })
    expect(calculateVoteScore(record)).toBeCloseTo(2 / 6)
  })

  it('does not count N as voted', () => {
    const record = makeRecord({ VH2024G: 'N', VH2022G: 'Y' })
    expect(calculateVoteScore(record)).toBeCloseTo(1 / 6)
  })
})

describe('determineSegment', () => {
  it('returns super-voter for score >= 0.8', () => {
    expect(determineSegment(0.8)).toBe('super-voter')
    expect(determineSegment(1.0)).toBe('super-voter')
  })

  it('returns sometimes-voter for score 0.3-0.79', () => {
    expect(determineSegment(0.3)).toBe('sometimes-voter')
    expect(determineSegment(0.5)).toBe('sometimes-voter')
    expect(determineSegment(0.79)).toBe('sometimes-voter')
  })

  it('returns rarely-voter for score < 0.3', () => {
    expect(determineSegment(0)).toBe('rarely-voter')
    expect(determineSegment(0.29)).toBe('rarely-voter')
  })
})

describe('isInTargetUniverse', () => {
  it('returns false when no target universe configured', () => {
    const record = makeRecord({ VH2024G: 'Y' })
    expect(isInTargetUniverse(record)).toBe(false)
    expect(isInTargetUniverse(record, undefined)).toBe(false)
  })

  it('returns true when voter matches all criteria', () => {
    const record = makeRecord({ VH2024G: 'Y', VH2022G: '' })
    const target: TargetUniverseConfig = { VH2024G: 'voted', VH2022G: 'did-not-vote' }
    expect(isInTargetUniverse(record, target)).toBe(true)
  })

  it('returns false when voter fails a criterion', () => {
    const record = makeRecord({ VH2024G: '' })
    const target: TargetUniverseConfig = { VH2024G: 'voted' }
    expect(isInTargetUniverse(record, target)).toBe(false)
  })

  it('returns false when target has no actual criteria', () => {
    const record = makeRecord({ VH2024G: 'Y' })
    expect(isInTargetUniverse(record, {})).toBe(false)
  })
})

describe('getVoteHistoryDetail', () => {
  it('returns details for all 6 elections', () => {
    const record = makeRecord({
      VH2024G: 'Y', VH2022G: 'A', VH2020G: 'E',
      VH2024P: 'N', VH2022P: '', VH2020P: 'Y',
    })
    const details = getVoteHistoryDetail(record)

    expect(details).toHaveLength(6)
    expect(details[0]).toEqual({ election: 'VH2024G', year: '2024', type: 'General', voted: true, method: 'In Person' })
    expect(details[1]).toEqual({ election: 'VH2022G', year: '2022', type: 'General', voted: true, method: 'Absentee' })
    expect(details[2]).toEqual({ election: 'VH2020G', year: '2020', type: 'General', voted: true, method: 'Early' })
    expect(details[3]).toEqual({ election: 'VH2024P', year: '2024', type: 'Primary', voted: false, method: 'Did Not Vote' })
    expect(details[4]).toEqual({ election: 'VH2022P', year: '2022', type: 'Primary', voted: false, method: 'Did Not Vote' })
    expect(details[5]).toEqual({ election: 'VH2020P', year: '2020', type: 'Primary', voted: true, method: 'In Person' })
  })
})
