import { VoterRecord, VoterSegment, MatchResult, SafeVoterRecord, VoteValue } from '@/types'

const ELECTION_FIELDS = ['VH2024G', 'VH2022G', 'VH2020G', 'VH2024P', 'VH2022P', 'VH2020P'] as const

const VOTED_VALUES = new Set<VoteValue>(['Y', 'A', 'E'])

export function calculateVoteScore(record: VoterRecord | SafeVoterRecord): number {
  let voteCount = 0
  for (const field of ELECTION_FIELDS) {
    if (VOTED_VALUES.has(record[field])) {
      voteCount++
    }
  }
  return voteCount / ELECTION_FIELDS.length
}

export function determineSegment(score: number): VoterSegment {
  if (score >= 0.8) return 'super-voter'
  if (score >= 0.3) return 'sometimes-voter'
  return 'rarely-voter'
}

export interface VoteHistoryDetail {
  election: string
  year: string
  type: 'General' | 'Primary'
  voted: boolean
  method: string
}

export function getVoteHistoryDetail(record: SafeVoterRecord): VoteHistoryDetail[] {
  const elections: { field: typeof ELECTION_FIELDS[number]; year: string; type: 'General' | 'Primary' }[] = [
    { field: 'VH2024G', year: '2024', type: 'General' },
    { field: 'VH2022G', year: '2022', type: 'General' },
    { field: 'VH2020G', year: '2020', type: 'General' },
    { field: 'VH2024P', year: '2024', type: 'Primary' },
    { field: 'VH2022P', year: '2022', type: 'Primary' },
    { field: 'VH2020P', year: '2020', type: 'Primary' },
  ]

  return elections.map(({ field, year, type }) => {
    const value = record[field]
    return {
      election: field,
      year,
      type,
      voted: VOTED_VALUES.has(value),
      method: value === 'Y' ? 'In Person'
        : value === 'A' ? 'Absentee'
          : value === 'E' ? 'Early'
            : 'Did Not Vote',
    }
  })
}

export function segmentResults(results: MatchResult[]) {
  const confirmed = results.filter(r => r.status === 'confirmed' || r.status === 'ambiguous')
  const matched = confirmed.filter(r => r.segment)

  return {
    superVoters: matched.filter(r => r.segment === 'super-voter'),
    sometimesVoters: matched.filter(r => r.segment === 'sometimes-voter'),
    rarelyVoters: matched.filter(r => r.segment === 'rarely-voter'),
    unmatched: results.filter(r => r.status === 'unmatched'),
    totalEntered: results.length,
    totalMatched: matched.length,
  }
}
