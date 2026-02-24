import Fuse from 'fuse.js'
import { VoterRecord, PersonEntry, MatchResult, MatchCandidate, MatchStatus, ConfidenceLevel, MatchedField, SafeVoterRecord } from '@/types'
import { calculateVoteScore, determineSegment } from './voter-segments'
import { getCityMatchScore } from './city-aliases'
import {
  queryVotersForMatch,
  queryVotersByMetaphone,
  queryVotersFuzzy,
} from './voter-db'

let jaroWinklerDistance: (s1: string, s2: string) => number

async function getJaroWinkler() {
  if (!jaroWinklerDistance) {
    const natural = await import('natural')
    jaroWinklerDistance = natural.JaroWinklerDistance
  }
  return jaroWinklerDistance
}

let doubleMetaphone: (word: string) => string[]

async function getDoubleMetaphone() {
  if (!doubleMetaphone) {
    const natural = await import('natural')
    const dm = new natural.DoubleMetaphone()
    doubleMetaphone = (word: string) => dm.process(word)
  }
  return doubleMetaphone
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z\s\-']/g, '').replace(/\s+/g, ' ')
}

export function normalizeCity(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, ' ')
}

const NICKNAME_MAP: Record<string, string[]> = {
  bob: ['robert'], bobby: ['robert'], rob: ['robert'], robbie: ['robert'],
  bill: ['william'], billy: ['william'], will: ['william'],
  jim: ['james'], jimmy: ['james'], jamie: ['james'],
  mike: ['michael'], mickey: ['michael'], mick: ['michael'],
  joe: ['joseph'], joey: ['joseph'],
  tom: ['thomas'], tommy: ['thomas'],
  dave: ['david'], davy: ['david'],
  dan: ['daniel'], danny: ['daniel'],
  chris: ['christopher', 'christian'], topher: ['christopher'],
  matt: ['matthew'], matty: ['matthew'],
  tony: ['anthony'],
  pat: ['patrick', 'patricia'], patty: ['patricia'], paddy: ['patrick'],
  sue: ['susan'], suzie: ['susan'],
  beth: ['elizabeth'], liz: ['elizabeth'], betty: ['elizabeth'], eliza: ['elizabeth'],
  becky: ['rebecca'], becca: ['rebecca'],
  jen: ['jennifer'], jenny: ['jennifer'],
  kate: ['katherine', 'katelyn'], katie: ['katherine', 'katelyn'],
  kathy: ['kathleen'], kat: ['katherine', 'kathleen'],
  barb: ['barbara'], babs: ['barbara'],
  meg: ['margaret'], maggie: ['margaret'], peg: ['margaret'], peggy: ['margaret'],
  ann: ['anne', 'anna'], annie: ['anne', 'anna'],
  nan: ['nancy'],
  carol: ['caroline', 'carolyn'],
  cathy: ['catherine'], cat: ['catherine'],
  terry: ['theresa', 'terrence'], tess: ['theresa'],
  tim: ['timothy'], timmy: ['timothy'],
  rick: ['richard', 'eric'], rich: ['richard'], dick: ['richard'],
  sam: ['samuel', 'samantha'],
  alex: ['alexander', 'alexandra', 'alexis'],
  ben: ['benjamin'], benji: ['benjamin'],
  charlie: ['charles'], chuck: ['charles'],
  ed: ['edward', 'edgar'], ted: ['edward', 'theodore'], teddy: ['theodore'],
  fred: ['frederick'], freddy: ['frederick'],
  greg: ['gregory'],
  ken: ['kenneth'], kenny: ['kenneth'],
  larry: ['lawrence'],
  nick: ['nicholas'], nicky: ['nicholas'],
  pete: ['peter'],
  ray: ['raymond'],
  ron: ['ronald'], ronny: ['ronald'],
  steve: ['steven', 'stephen'],
  andy: ['andrew'], drew: ['andrew'],
  walt: ['walter'], wally: ['walter'],
  jack: ['john'], johnny: ['john'],
  hank: ['henry'],
}

export function expandNicknames(firstName: string): string[] {
  const normalized = firstName.toLowerCase().trim()
  const expansions = NICKNAME_MAP[normalized] ?? []

  // Also check reverse: if they entered "Robert", include "bob"
  const reverseMatches: string[] = []
  for (const [nick, formals] of Object.entries(NICKNAME_MAP)) {
    if (formals.includes(normalized)) {
      reverseMatches.push(nick)
    }
  }

  return [...new Set([normalized, ...expansions, ...reverseMatches])]
}

export function ageRangeToYears(ageRange: string): { min: number; max: number } {
  const currentYear = new Date().getFullYear()
  const ranges: Record<string, { min: number; max: number }> = {
    'under-25': { min: currentYear - 24, max: currentYear - 18 },
    '25-34': { min: currentYear - 34, max: currentYear - 25 },
    '35-44': { min: currentYear - 44, max: currentYear - 35 },
    '45-54': { min: currentYear - 54, max: currentYear - 45 },
    '55-64': { min: currentYear - 64, max: currentYear - 55 },
    '65+': { min: 1900, max: currentYear - 65 },
  }
  return ranges[ageRange] ?? { min: 1900, max: currentYear }
}

export function birthYearInRange(dob: string, ageRange: string): boolean {
  const birthYear = parseInt(dob.slice(0, 4))
  const { min, max } = ageRangeToYears(ageRange)
  return birthYear >= min && birthYear <= max
}

function sanitizeVoterRecord(record: VoterRecord): SafeVoterRecord {
  const { voter_id, date_of_birth, ...rest } = record
  return {
    ...rest,
    birth_year: date_of_birth ? date_of_birth.slice(0, 4) : undefined,
  }
}

export interface MatchingOptions {
  highConfidenceThreshold: number
  mediumConfidenceThreshold: number
  lowCutoff: number
  maxCandidatesPerPerson: number
}

const DEFAULT_OPTIONS: MatchingOptions = {
  highConfidenceThreshold: 0.90,
  mediumConfidenceThreshold: 0.70,
  lowCutoff: 0.55,
  maxCandidatesPerPerson: 3,
}

// =============================================
// LAST NAME INDEX for fast lookup on large files
// =============================================

interface VoterIndex {
  byLastName: Map<string, VoterRecord[]>
  byLastNamePhonetic: Map<string, VoterRecord[]>
  byZip: Map<string, VoterRecord[]>
  all: VoterRecord[]
}

const indexCache = new WeakMap<VoterRecord[], VoterIndex>()

function buildIndex(voterFile: VoterRecord[], dm: (word: string) => string[]): VoterIndex {
  if (indexCache.has(voterFile)) return indexCache.get(voterFile)!

  console.log(`[matching] Building index for ${voterFile.length.toLocaleString()} records...`)
  const start = Date.now()

  const byLastName = new Map<string, VoterRecord[]>()
  const byLastNamePhonetic = new Map<string, VoterRecord[]>()
  const byZip = new Map<string, VoterRecord[]>()

  for (const record of voterFile) {
    // Index by normalized last name
    const lastName = normalizeName(record.last_name)
    if (!byLastName.has(lastName)) byLastName.set(lastName, [])
    byLastName.get(lastName)!.push(record)

    // Index by Double Metaphone codes for last name
    const lastNameCodes = dm(lastName)
    for (const code of lastNameCodes) {
      if (code) {
        if (!byLastNamePhonetic.has(code)) byLastNamePhonetic.set(code, [])
        byLastNamePhonetic.get(code)!.push(record)
      }
    }

    // Index by zip
    const zip = record.zip?.trim().slice(0, 5)
    if (zip) {
      if (!byZip.has(zip)) byZip.set(zip, [])
      byZip.get(zip)!.push(record)
    }
  }

  const index: VoterIndex = { byLastName, byLastNamePhonetic, byZip, all: voterFile }
  indexCache.set(voterFile, index)

  console.log(`[matching] Index built in ${Date.now() - start}ms (${byLastName.size.toLocaleString()} last names, ${byLastNamePhonetic.size.toLocaleString()} phonetic codes, ${byZip.size.toLocaleString()} zips)`)
  return index
}

// =============================================
// MAIN MATCHING FUNCTION
// =============================================

export async function matchPeopleToVoterFile(
  people: PersonEntry[],
  voterFile: VoterRecord[],
  options: Partial<MatchingOptions> = {}
): Promise<MatchResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const jw = await getJaroWinkler()
  const dm = await getDoubleMetaphone()

  // Build index for fast lookup (cached for repeated calls)
  const index = buildIndex(voterFile, dm)

  const results: MatchResult[] = []

  for (const person of people) {
    const result = matchSinglePerson(person, index, jw, dm, opts)
    results.push(result)
  }

  return results
}

function matchSinglePerson(
  person: PersonEntry,
  index: VoterIndex,
  jw: (s1: string, s2: string) => number,
  dm: (word: string) => string[],
  opts: MatchingOptions
): MatchResult {
  const normalFirst = normalizeName(person.firstName)
  const normalLast = normalizeName(person.lastName)
  const nicknameForms = expandNicknames(normalFirst)

  // PASS 1: Exact last name lookup (indexed — instant even for 700K records)
  const lastNameMatches = index.byLastName.get(normalLast) ?? []

  // Filter to matching first names (exact or nickname)
  const exactMatches = lastNameMatches.filter(record => {
    const recFirst = normalizeName(record.first_name)
    return nicknameForms.includes(recFirst) || recFirst === normalFirst
  })

  if (exactMatches.length > 0) {
    const candidates = rankExactCandidates(exactMatches, person, jw, opts)
    return buildMatchResult(person, candidates, opts)
  }

  // PASS 1.5: Phonetic name lookup (Double Metaphone)
  // Catches spelling variants like Billie/Billy, Kaitlyn/Caitlin, Sean/Shawn
  const lastNameCodes = dm(normalLast)
  const phoneticLastNameMatches = new Map<string, VoterRecord>()

  for (const code of lastNameCodes) {
    if (!code) continue
    const records = index.byLastNamePhonetic.get(code) ?? []
    for (const record of records) {
      // Deduplicate by voter_id
      if (!phoneticLastNameMatches.has(record.voter_id)) {
        phoneticLastNameMatches.set(record.voter_id, record)
      }
    }
  }

  if (phoneticLastNameMatches.size > 0) {
    // Filter to matching first names via phonetic or nickname expansion
    const inputFirstCodes = dm(normalFirst)
    const nicknameFirstCodes = nicknameForms.flatMap(n => dm(n))
    const allFirstCodes = new Set([...inputFirstCodes, ...nicknameFirstCodes].filter(Boolean))

    const phoneticMatches = Array.from(phoneticLastNameMatches.values()).filter(record => {
      const recFirst = normalizeName(record.first_name)
      const recFirstCodes = dm(recFirst)
      return recFirstCodes.some(code => code && allFirstCodes.has(code))
    })

    if (phoneticMatches.length > 0) {
      const candidates = rankPhoneticCandidates(phoneticMatches, person, jw, opts)
      return buildMatchResult(person, candidates, opts)
    }
  }

  // PASS 2: Fuzzy search — use a narrowed candidate set instead of full file
  // For large files (>10K), narrow candidates by last name similarity first
  let candidatePool: VoterRecord[]
  if (index.all.length > 10000) {
    // Find last names that are similar (first 2-3 chars match or JW > 0.8)
    candidatePool = []
    const prefix2 = normalLast.slice(0, 2)
    const prefix3 = normalLast.slice(0, 3)

    for (const [lastName, records] of index.byLastName) {
      if (lastName.startsWith(prefix2) || lastName.startsWith(prefix3) ||
          (normalLast.length > 3 && lastName.startsWith(normalLast.slice(0, 4)))) {
        candidatePool.push(...records)
      }
    }

    // Also add same-zip voters for additional coverage
    if (person.zip) {
      const zipRecords = index.byZip.get(person.zip.trim().slice(0, 5)) ?? []
      const existingIds = new Set(candidatePool.map(r => r.voter_id))
      for (const r of zipRecords) {
        if (!existingIds.has(r.voter_id)) {
          candidatePool.push(r)
        }
      }
    }

    // Cap the pool to avoid massive Fuse searches
    if (candidatePool.length > 5000) {
      candidatePool = candidatePool.slice(0, 5000)
    }
  } else {
    candidatePool = index.all
  }

  if (candidatePool.length === 0) {
    return { personEntry: person, status: 'unmatched', candidates: [] }
  }

  // Build Fuse index on the narrowed pool
  const fuse = new Fuse(candidatePool, {
    keys: [
      { name: 'first_name', weight: 0.5 },
      { name: 'last_name', weight: 0.5 },
    ],
    threshold: 0.5,
    includeScore: true,
  })

  const fuseResults = fuse.search(`${person.firstName} ${person.lastName}`, { limit: 20 })

  // PASS 3: Jaro-Winkler scoring
  const scoredCandidates: MatchCandidate[] = fuseResults
    .map(r => {
      const record = r.item
      const recFirst = normalizeName(record.first_name)
      const recLast = normalizeName(record.last_name)

      const lastScore = jw(normalLast, recLast)
      const firstScore = Math.max(...nicknameForms.map(n => jw(n, recFirst)))

      let combinedScore = (lastScore * 0.55) + (firstScore * 0.45)
      const matchedOn: MatchedField[] = ['fuzzy-name']

      // PASS 4: Contextual boosters — smart city matching (Queens↔NYC etc.)
      if (person.city && record.city) {
        const smartCityScore = getCityMatchScore(person.city, record.city, person.zip, record.zip, jw)
        if (smartCityScore > 0.85) {
          combinedScore = Math.min(1.0, combinedScore * 1.1)
          matchedOn.push('city')
        } else if (smartCityScore < 0.3) {
          combinedScore *= 0.85
        }
      }

      if (person.zip && record.zip) {
        if (person.zip.trim() === record.zip.trim()) {
          combinedScore = Math.min(1.0, combinedScore * 1.08)
          matchedOn.push('zip')
        }
      }

      if (person.address && record.residential_address) {
        const addrScore = jw(
          person.address.toLowerCase().trim(),
          record.residential_address.toLowerCase().trim()
        )
        if (addrScore > 0.80) {
          combinedScore = Math.min(1.0, combinedScore * 1.15)
          matchedOn.push('address')
        }
      }

      // Exact age → birth year comparison (stronger than age range)
      if (person.age && record.date_of_birth) {
        const birthYear = parseInt(record.date_of_birth.slice(0, 4))
        const currentYear = new Date().getFullYear()
        const estimatedAge = currentYear - birthYear
        if (Math.abs(estimatedAge - person.age) <= 1) {
          combinedScore = Math.min(1.0, combinedScore * 1.08)
          matchedOn.push('exact-age')
        } else if (Math.abs(estimatedAge - person.age) > 5) {
          combinedScore *= 0.88
        }
      } else if (person.ageRange && record.date_of_birth) {
        if (birthYearInRange(record.date_of_birth, person.ageRange)) {
          combinedScore = Math.min(1.0, combinedScore * 1.05)
          matchedOn.push('age-range')
        } else {
          combinedScore *= 0.90
        }
      }

      if (person.gender && record.gender) {
        if (person.gender === record.gender) {
          combinedScore = Math.min(1.0, combinedScore * 1.03)
          matchedOn.push('gender')
        } else {
          combinedScore *= 0.90
        }
      }

      const confidenceLevel: ConfidenceLevel =
        combinedScore >= opts.highConfidenceThreshold ? 'high'
          : combinedScore >= opts.mediumConfidenceThreshold ? 'medium' : 'low'

      return {
        voterRecord: sanitizeVoterRecord(record),
        score: combinedScore,
        confidenceLevel,
        matchedOn,
      }
    })
    .filter(c => c.score >= opts.lowCutoff)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxCandidatesPerPerson)

  return buildMatchResult(person, scoredCandidates, opts)
}

function rankExactCandidates(
  records: VoterRecord[],
  person: PersonEntry,
  jw: (s1: string, s2: string) => number,
  opts: MatchingOptions
): MatchCandidate[] {
  return records
    .map(record => {
      let score = 1.0
      const fields: MatchedField[] = ['exact-name']

      if (person.city && record.city) {
        const smartCityScore = getCityMatchScore(person.city, record.city, person.zip, record.zip)
        if (smartCityScore > 0.85) {
          fields.push('city')
        } else if (smartCityScore < 0.3) {
          score = 0.92
        }
      }

      if (person.zip && record.zip) {
        if (person.zip.trim() === record.zip.trim()) {
          fields.push('zip')
        }
      }

      if (person.address && record.residential_address) {
        const addrScore = jw(
          person.address.toLowerCase().trim(),
          record.residential_address.toLowerCase().trim()
        )
        if (addrScore > 0.80) {
          fields.push('address')
        } else {
          score = Math.min(score, 0.93)
        }
      }

      // Exact age takes priority over age range
      if (person.age && record.date_of_birth) {
        const birthYear = parseInt(record.date_of_birth.slice(0, 4))
        const currentYear = new Date().getFullYear()
        const estimatedAge = currentYear - birthYear
        if (Math.abs(estimatedAge - person.age) <= 1) {
          fields.push('exact-age')
        } else if (Math.abs(estimatedAge - person.age) > 5) {
          score = Math.min(score, 0.85)
        }
      } else if (person.ageRange && record.date_of_birth) {
        if (birthYearInRange(record.date_of_birth, person.ageRange)) {
          fields.push('age-range')
        } else {
          score = Math.min(score, 0.88)
        }
      }

      if (person.gender && record.gender) {
        if (person.gender === record.gender) {
          fields.push('gender')
        } else {
          score = Math.min(score, 0.87)
        }
      }

      return {
        voterRecord: sanitizeVoterRecord(record),
        score,
        confidenceLevel: (score >= opts.highConfidenceThreshold ? 'high' : 'medium') as ConfidenceLevel,
        matchedOn: fields,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxCandidatesPerPerson)
}

function rankPhoneticCandidates(
  records: VoterRecord[],
  person: PersonEntry,
  jw: (s1: string, s2: string) => number,
  opts: MatchingOptions
): MatchCandidate[] {
  return records
    .map(record => {
      let score = 0.95 // Cap at 0.95 for phonetic (not exact) matches
      const fields: MatchedField[] = ['phonetic-name']

      if (person.city && record.city) {
        const smartCityScore = getCityMatchScore(person.city, record.city, person.zip, record.zip)
        if (smartCityScore > 0.85) {
          fields.push('city')
        } else if (smartCityScore < 0.3) {
          score = Math.min(score, 0.87)
        }
      }

      if (person.zip && record.zip) {
        if (person.zip.trim() === record.zip.trim()) {
          fields.push('zip')
        }
      }

      if (person.address && record.residential_address) {
        const addrScore = jw(
          person.address.toLowerCase().trim(),
          record.residential_address.toLowerCase().trim()
        )
        if (addrScore > 0.80) {
          fields.push('address')
        } else {
          score = Math.min(score, 0.88)
        }
      }

      // Exact age takes priority over age range
      if (person.age && record.date_of_birth) {
        const birthYear = parseInt(record.date_of_birth.slice(0, 4))
        const currentYear = new Date().getFullYear()
        const estimatedAge = currentYear - birthYear
        if (Math.abs(estimatedAge - person.age) <= 1) {
          fields.push('exact-age')
        } else if (Math.abs(estimatedAge - person.age) > 5) {
          score = Math.min(score, 0.80)
        }
      } else if (person.ageRange && record.date_of_birth) {
        if (birthYearInRange(record.date_of_birth, person.ageRange)) {
          fields.push('age-range')
        } else {
          score = Math.min(score, 0.83)
        }
      }

      if (person.gender && record.gender) {
        if (person.gender === record.gender) {
          fields.push('gender')
        } else {
          score = Math.min(score, 0.82)
        }
      }

      return {
        voterRecord: sanitizeVoterRecord(record),
        score,
        confidenceLevel: (score >= opts.highConfidenceThreshold ? 'high' : 'medium') as ConfidenceLevel,
        matchedOn: fields,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxCandidatesPerPerson)
}

function buildMatchResult(
  person: PersonEntry,
  candidates: MatchCandidate[],
  opts: MatchingOptions
): MatchResult {
  if (candidates.length === 0) {
    return { personEntry: person, status: 'unmatched', candidates: [] }
  }

  const best = candidates[0]
  let status: MatchStatus

  // Never auto-confirm — all matches require volunteer confirmation.
  // Mark as 'ambiguous' (needs review) so the AI presents them for approval.
  if (best.score >= opts.mediumConfidenceThreshold) {
    status = 'ambiguous'
  } else {
    status = 'unmatched'
  }

  const voteScore = status !== 'unmatched' ? calculateVoteScore(best.voterRecord) : undefined

  return {
    personEntry: person,
    status,
    bestMatch: status !== 'unmatched' ? best.voterRecord : undefined,
    candidates,
    voteScore,
    segment: voteScore !== undefined ? determineSegment(voteScore) : undefined,
  }
}

// =============================================
// DB-BACKED MATCHING (replaces in-memory file)
// =============================================

/**
 * Match people against voter records stored in PostgreSQL.
 * Same 4-pass algorithm as matchPeopleToVoterFile, but fetches
 * candidates from DB instead of scanning in-memory arrays.
 */
export async function matchPeopleToVoterDb(
  people: PersonEntry[],
  datasetId: string,
  options: Partial<MatchingOptions> = {}
): Promise<MatchResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const jw = await getJaroWinkler()
  const dm = await getDoubleMetaphone()

  const results: MatchResult[] = []

  for (const person of people) {
    const result = await matchSinglePersonDb(person, datasetId, jw, dm, opts)
    results.push(result)
  }

  return results
}

async function matchSinglePersonDb(
  person: PersonEntry,
  datasetId: string,
  jw: (s1: string, s2: string) => number,
  dm: (word: string) => string[],
  opts: MatchingOptions
): Promise<MatchResult> {
  const normalFirst = normalizeName(person.firstName)
  const normalLast = normalizeName(person.lastName)
  const nicknameForms = expandNicknames(normalFirst)

  // PASS 1: Exact last name lookup via DB index
  const lastNameMatches = await queryVotersForMatch(datasetId, [normalLast])

  const exactMatches = lastNameMatches.filter(record => {
    const recFirst = normalizeName(record.first_name)
    return nicknameForms.includes(recFirst) || recFirst === normalFirst
  })

  if (exactMatches.length > 0) {
    const candidates = rankExactCandidates(exactMatches, person, jw, opts)
    return buildMatchResult(person, candidates, opts)
  }

  // PASS 1.5: Phonetic name lookup via DB
  const lastNameCodes = dm(normalLast)
  const phoneticLastNameMatches = await queryVotersByMetaphone(datasetId, lastNameCodes)

  // Deduplicate
  const phoneticUnique = new Map<string, VoterRecord>()
  for (const record of phoneticLastNameMatches) {
    if (!phoneticUnique.has(record.voter_id)) {
      phoneticUnique.set(record.voter_id, record)
    }
  }

  if (phoneticUnique.size > 0) {
    const inputFirstCodes = dm(normalFirst)
    const nicknameFirstCodes = nicknameForms.flatMap(n => dm(n))
    const allFirstCodes = new Set([...inputFirstCodes, ...nicknameFirstCodes].filter(Boolean))

    const phoneticMatches = Array.from(phoneticUnique.values()).filter(record => {
      const recFirst = normalizeName(record.first_name)
      const recFirstCodes = dm(recFirst)
      return recFirstCodes.some(code => code && allFirstCodes.has(code))
    })

    if (phoneticMatches.length > 0) {
      const candidates = rankPhoneticCandidates(phoneticMatches, person, jw, opts)
      return buildMatchResult(person, candidates, opts)
    }
  }

  // PASS 2: Fuzzy search via trigram similarity in DB
  const candidatePool = await queryVotersFuzzy(datasetId, normalLast, person.zip)

  if (candidatePool.length === 0) {
    return { personEntry: person, status: 'unmatched', candidates: [] }
  }

  // Build Fuse index on the narrowed pool (same as in-memory version)
  const fuse = new Fuse(candidatePool, {
    keys: [
      { name: 'first_name', weight: 0.5 },
      { name: 'last_name', weight: 0.5 },
    ],
    threshold: 0.5,
    includeScore: true,
  })

  const fuseResults = fuse.search(`${person.firstName} ${person.lastName}`, { limit: 20 })

  // PASS 3+4: Jaro-Winkler scoring + contextual boosters (identical to in-memory)
  const scoredCandidates: MatchCandidate[] = fuseResults
    .map(r => {
      const record = r.item
      const recFirst = normalizeName(record.first_name)
      const recLast = normalizeName(record.last_name)

      const lastScore = jw(normalLast, recLast)
      const firstScore = Math.max(...nicknameForms.map(n => jw(n, recFirst)))

      let combinedScore = (lastScore * 0.55) + (firstScore * 0.45)
      const matchedOn: MatchedField[] = ['fuzzy-name']

      if (person.city && record.city) {
        const smartCityScore = getCityMatchScore(person.city, record.city, person.zip, record.zip, jw)
        if (smartCityScore > 0.85) {
          combinedScore = Math.min(1.0, combinedScore * 1.1)
          matchedOn.push('city')
        } else if (smartCityScore < 0.3) {
          combinedScore *= 0.85
        }
      }

      if (person.zip && record.zip) {
        if (person.zip.trim() === record.zip.trim()) {
          combinedScore = Math.min(1.0, combinedScore * 1.08)
          matchedOn.push('zip')
        }
      }

      if (person.address && record.residential_address) {
        const addrScore = jw(
          person.address.toLowerCase().trim(),
          record.residential_address.toLowerCase().trim()
        )
        if (addrScore > 0.80) {
          combinedScore = Math.min(1.0, combinedScore * 1.15)
          matchedOn.push('address')
        }
      }

      if (person.age && record.date_of_birth) {
        const birthYear = parseInt(record.date_of_birth.slice(0, 4))
        const currentYear = new Date().getFullYear()
        const estimatedAge = currentYear - birthYear
        if (Math.abs(estimatedAge - person.age) <= 1) {
          combinedScore = Math.min(1.0, combinedScore * 1.08)
          matchedOn.push('exact-age')
        } else if (Math.abs(estimatedAge - person.age) > 5) {
          combinedScore *= 0.88
        }
      } else if (person.ageRange && record.date_of_birth) {
        if (birthYearInRange(record.date_of_birth, person.ageRange)) {
          combinedScore = Math.min(1.0, combinedScore * 1.05)
          matchedOn.push('age-range')
        } else {
          combinedScore *= 0.90
        }
      }

      if (person.gender && record.gender) {
        if (person.gender === record.gender) {
          combinedScore = Math.min(1.0, combinedScore * 1.03)
          matchedOn.push('gender')
        } else {
          combinedScore *= 0.90
        }
      }

      const confidenceLevel: ConfidenceLevel =
        combinedScore >= opts.highConfidenceThreshold ? 'high'
          : combinedScore >= opts.mediumConfidenceThreshold ? 'medium' : 'low'

      return {
        voterRecord: sanitizeVoterRecord(record),
        score: combinedScore,
        confidenceLevel,
        matchedOn,
      }
    })
    .filter(c => c.score >= opts.lowCutoff)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxCandidatesPerPerson)

  return buildMatchResult(person, scoredCandidates, opts)
}
