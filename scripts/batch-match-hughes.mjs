#!/usr/bin/env node
/**
 * Batch-match all pending contacts for the Hughes 2026 campaign
 * against the CT HD-135 voter dataset.
 *
 * Usage: node scripts/batch-match-hughes.mjs
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import pg from 'pg'
import natural from 'natural'
import Fuse from 'fuse.js'

const { Pool } = pg
const dbUrl = process.env.DATABASE_URL || ''
const useSSL = dbUrl.includes('.railway.internal') ? false : { rejectUnauthorized: false }
const pool = new Pool({
  connectionString: dbUrl,
  ssl: useSSL,
})

// ── Matching helpers (ported from src/lib/matching.ts) ──

const JaroWinklerDistance = natural.JaroWinklerDistance
const dm = new natural.DoubleMetaphone()
const doubleMetaphone = (word) => dm.process(word)

function normalizeName(name) {
  return name.toLowerCase().trim().replace(/[^a-z\s\-']/g, '').replace(/\s+/g, ' ')
}

const NICKNAME_MAP = {
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

function expandNicknames(firstName) {
  const normalized = firstName.toLowerCase().trim()
  const expansions = NICKNAME_MAP[normalized] ?? []
  const reverseMatches = []
  for (const [nick, formals] of Object.entries(NICKNAME_MAP)) {
    if (formals.includes(normalized)) reverseMatches.push(nick)
  }
  return [...new Set([normalized, ...expansions, ...reverseMatches])]
}

function getCityMatchScore(city1, city2, zip1, zip2) {
  const c1 = city1.toLowerCase().trim()
  const c2 = city2.toLowerCase().trim()
  if (c1 === c2) return 1.0
  // Same zip = likely same city area
  if (zip1 && zip2 && zip1.trim().slice(0, 5) === zip2.trim().slice(0, 5)) return 0.9
  return JaroWinklerDistance(c1, c2)
}

const ELECTION_FIELDS = ['VH2024G', 'VH2022G', 'VH2020G', 'VH2024P', 'VH2022P', 'VH2020P']
const VOTED_VALUES = new Set(['Y', 'A', 'E'])

function calculateVoteScore(record) {
  let voteCount = 0
  for (const field of ELECTION_FIELDS) {
    if (VOTED_VALUES.has(record[field])) voteCount++
  }
  return voteCount / ELECTION_FIELDS.length
}

function determineSegment(score) {
  if (score >= 0.8) return 'super-voter'
  if (score >= 0.3) return 'sometimes-voter'
  return 'rarely-voter'
}

const VOTER_SELECT = `voter_id, first_name, last_name, date_of_birth, gender,
  residential_address, city, state, zip, party_affiliation, registration_date,
  voter_status, vh2024g, vh2022g, vh2020g, vh2024p, vh2022p, vh2020p, lat, lng,
  congressional_district, state_senate_district, state_house_district`

function rowToVoterRecord(row) {
  return {
    voter_id: row.voter_id,
    first_name: row.first_name,
    last_name: row.last_name,
    date_of_birth: row.date_of_birth || '',
    gender: row.gender || 'U',
    residential_address: row.residential_address || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    party_affiliation: row.party_affiliation || 'UNR',
    registration_date: row.registration_date || '',
    voter_status: row.voter_status || 'Active',
    VH2024G: row.vh2024g || '',
    VH2022G: row.vh2022g || '',
    VH2020G: row.vh2020g || '',
    VH2024P: row.vh2024p || '',
    VH2022P: row.vh2022p || '',
    VH2020P: row.vh2020p || '',
    lat: row.lat,
    lng: row.lng,
    congressional_district: row.congressional_district || null,
    state_senate_district: row.state_senate_district || null,
    state_house_district: row.state_house_district || null,
  }
}

function sanitizeVoterRecord(record) {
  const { voter_id, date_of_birth, ...rest } = record
  return { ...rest, birth_year: date_of_birth ? date_of_birth.slice(0, 4) : undefined }
}

// ── DB query helpers ──

async function queryVotersExact(datasetId, lastNames) {
  if (!lastNames.length) return []
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters WHERE dataset_id = $1 AND last_name_normalized = ANY($2)`,
    [datasetId, lastNames]
  )
  return rows.map(rowToVoterRecord)
}

async function queryVotersByMetaphone(datasetId, codes) {
  const validCodes = codes.filter(Boolean)
  if (!validCodes.length) return []
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters WHERE dataset_id = $1 AND last_name_metaphone = ANY($2)`,
    [datasetId, validCodes]
  )
  return rows.map(rowToVoterRecord)
}

async function queryVotersFuzzy(datasetId, lastName, zip) {
  const results = new Map()
  const { rows: trigramRows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1 AND similarity(last_name_normalized, $2) > 0.3
     ORDER BY similarity(last_name_normalized, $2) DESC LIMIT 3000`,
    [datasetId, lastName]
  )
  for (const row of trigramRows) {
    const vr = rowToVoterRecord(row)
    results.set(vr.voter_id, vr)
  }
  if (zip && results.size < 5000) {
    const cleanZip = zip.trim().slice(0, 5)
    const { rows: zipRows } = await pool.query(
      `SELECT ${VOTER_SELECT} FROM voters
       WHERE dataset_id = $1 AND zip = $2 LIMIT $3`,
      [datasetId, cleanZip, 5000 - results.size]
    )
    for (const row of zipRows) {
      const vr = rowToVoterRecord(row)
      if (!results.has(vr.voter_id)) results.set(vr.voter_id, vr)
    }
  }
  return Array.from(results.values())
}

// ── Single person match (4-pass, DB-backed) ──

const OPTS = {
  highConfidenceThreshold: 0.90,
  mediumConfidenceThreshold: 0.70,
  lowCutoff: 0.55,
  maxCandidatesPerPerson: 3,
}

function rankCandidates(records, person, isExact) {
  return records
    .map(record => {
      let score = isExact ? 1.0 : 0.95
      const fields = [isExact ? 'exact-name' : 'phonetic-name']
      const nicknameForms = expandNicknames(normalizeName(person.first_name))

      if (person.city && record.city) {
        const cs = getCityMatchScore(person.city, record.city, person.zip, record.zip)
        if (cs > 0.85) fields.push('city')
        else if (cs < 0.3) score = Math.min(score, isExact ? 0.92 : 0.87)
      }
      if (person.zip && record.zip && person.zip.trim() === record.zip.trim()) {
        fields.push('zip')
      }

      return {
        voterRecord: sanitizeVoterRecord(record),
        score,
        confidenceLevel: score >= OPTS.highConfidenceThreshold ? 'high' : 'medium',
        matchedOn: fields,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, OPTS.maxCandidatesPerPerson)
}

async function matchSinglePerson(person, datasetId) {
  const normalFirst = normalizeName(person.first_name)
  const normalLast = normalizeName(person.last_name)
  const nicknameForms = expandNicknames(normalFirst)

  // PASS 1: Exact last name
  const lastNameMatches = await queryVotersExact(datasetId, [normalLast])
  const exactMatches = lastNameMatches.filter(r => {
    const recFirst = normalizeName(r.first_name)
    return nicknameForms.includes(recFirst) || recFirst === normalFirst
  })
  if (exactMatches.length > 0) {
    const candidates = rankCandidates(exactMatches, person, true)
    return buildResult(person, candidates)
  }

  // PASS 1.5: Phonetic
  const lastNameCodes = doubleMetaphone(normalLast)
  const phoneticMatches = await queryVotersByMetaphone(datasetId, lastNameCodes)
  const phoneticUnique = new Map()
  for (const r of phoneticMatches) {
    if (!phoneticUnique.has(r.voter_id)) phoneticUnique.set(r.voter_id, r)
  }

  if (phoneticUnique.size > 0) {
    const inputFirstCodes = doubleMetaphone(normalFirst)
    const nicknameFirstCodes = nicknameForms.flatMap(n => doubleMetaphone(n))
    const allFirstCodes = new Set([...inputFirstCodes, ...nicknameFirstCodes].filter(Boolean))

    const matched = Array.from(phoneticUnique.values()).filter(r => {
      const recFirst = normalizeName(r.first_name)
      const recFirstCodes = doubleMetaphone(recFirst)
      return recFirstCodes.some(code => code && allFirstCodes.has(code))
    })

    if (matched.length > 0) {
      const candidates = rankCandidates(matched, person, false)
      return buildResult(person, candidates)
    }
  }

  // PASS 2+3+4: Fuzzy
  const candidatePool = await queryVotersFuzzy(datasetId, normalLast, person.zip)
  if (candidatePool.length === 0) return { status: 'unmatched', candidates: [] }

  const fuse = new Fuse(candidatePool, {
    keys: [{ name: 'first_name', weight: 0.5 }, { name: 'last_name', weight: 0.5 }],
    threshold: 0.5, includeScore: true,
  })
  const fuseResults = fuse.search(`${person.first_name} ${person.last_name}`, { limit: 20 })

  const scoredCandidates = fuseResults
    .map(r => {
      const record = r.item
      const recFirst = normalizeName(record.first_name)
      const recLast = normalizeName(record.last_name)

      const lastScore = JaroWinklerDistance(normalLast, recLast)
      const firstScore = Math.max(...nicknameForms.map(n => JaroWinklerDistance(n, recFirst)))
      let combinedScore = (lastScore * 0.55) + (firstScore * 0.45)
      const matchedOn = ['fuzzy-name']

      if (person.city && record.city) {
        const cs = getCityMatchScore(person.city, record.city, person.zip, record.zip)
        if (cs > 0.85) { combinedScore = Math.min(1.0, combinedScore * 1.1); matchedOn.push('city') }
        else if (cs < 0.3) combinedScore *= 0.85
      }
      if (person.zip && record.zip && person.zip.trim() === record.zip.trim()) {
        combinedScore = Math.min(1.0, combinedScore * 1.08); matchedOn.push('zip')
      }

      const confidenceLevel =
        combinedScore >= OPTS.highConfidenceThreshold ? 'high'
          : combinedScore >= OPTS.mediumConfidenceThreshold ? 'medium'
          : combinedScore >= OPTS.lowCutoff ? 'low' : 'very-low'

      return { voterRecord: sanitizeVoterRecord(record), score: combinedScore, confidenceLevel, matchedOn }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, OPTS.maxCandidatesPerPerson)

  return buildResult(person, scoredCandidates)
}

function buildResult(person, candidates) {
  if (candidates.length === 0) return { status: 'unmatched', candidates: [] }
  const best = candidates[0]
  const status = best.score >= OPTS.lowCutoff ? 'ambiguous' : 'unmatched'
  const voteScore = best.score >= OPTS.lowCutoff ? calculateVoteScore(best.voterRecord) : undefined
  return {
    status,
    bestMatch: best.voterRecord,
    candidates,
    voteScore,
    segment: voteScore !== undefined ? determineSegment(voteScore) : undefined,
  }
}

// ── Main ──

async function main() {
  // 1. Find the Hughes campaign
  const { rows: campRows } = await pool.query(
    "SELECT id, name FROM campaigns WHERE name ILIKE '%hughes%'"
  )
  if (!campRows.length) { console.error('Hughes campaign not found'); process.exit(1) }
  const campaignId = campRows[0].id
  console.log(`Campaign: ${campRows[0].name} (${campaignId})`)

  // 2. Get dataset
  const { rows: dsRows } = await pool.query(
    `SELECT cvd.dataset_id FROM campaign_voter_datasets cvd
     JOIN voter_datasets vd ON vd.id = cvd.dataset_id
     WHERE cvd.campaign_id = $1 AND vd.status = 'ready' LIMIT 1`,
    [campaignId]
  )
  if (!dsRows.length) { console.error('No voter dataset assigned'); process.exit(1) }
  const datasetId = dsRows[0].dataset_id
  console.log(`Dataset: ${datasetId}`)

  // 3. Get pending contacts
  const { rows: pendingContacts } = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.city, c.zip, c.address, c.age, c.age_range, c.gender
     FROM contacts c
     JOIN match_results mr ON mr.contact_id = c.id
     WHERE c.campaign_id = $1 AND mr.status = 'pending'
     ORDER BY c.last_name`,
    [campaignId]
  )
  console.log(`\nPending contacts to match: ${pendingContacts.length}\n`)

  if (pendingContacts.length === 0) {
    console.log('All contacts already matched!')
    await pool.end()
    return
  }

  // 4. Match each contact
  let matched = 0, unmatched = 0, errors = 0
  const results = []

  for (let i = 0; i < pendingContacts.length; i++) {
    const contact = pendingContacts[i]
    try {
      const result = await matchSinglePerson(contact, datasetId)

      // Update match_results in DB
      await pool.query(
        `UPDATE match_results SET
           status = $1,
           best_match_data = $2,
           candidates_data = $3,
           vote_score = $4,
           segment = $5,
           updated_at = NOW()
         WHERE contact_id = $6`,
        [
          result.status,
          result.bestMatch ? JSON.stringify(result.bestMatch) : null,
          JSON.stringify(result.candidates),
          result.voteScore ?? null,
          result.segment ?? null,
          contact.id,
        ]
      )

      const tag = result.status === 'ambiguous' ? 'MATCHED' : 'UNMATCHED'
      const score = result.candidates[0]?.score?.toFixed(3) ?? 'N/A'
      const matchName = result.bestMatch ? `${result.bestMatch.first_name} ${result.bestMatch.last_name}` : '—'
      console.log(`  [${i + 1}/${pendingContacts.length}] ${tag} ${contact.first_name} ${contact.last_name} → ${matchName} (score: ${score})`)

      if (result.status === 'ambiguous') matched++
      else unmatched++

      results.push({ contact: `${contact.first_name} ${contact.last_name}`, ...result })
    } catch (err) {
      errors++
      console.error(`  [${i + 1}] ERROR matching ${contact.first_name} ${contact.last_name}:`, err.message)
    }
  }

  // 5. Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log(`BATCH MATCHING COMPLETE`)
  console.log(`${'='.repeat(50)}`)
  console.log(`  Total processed: ${pendingContacts.length}`)
  console.log(`  Matched (ambiguous, needs review): ${matched}`)
  console.log(`  Unmatched: ${unmatched}`)
  console.log(`  Errors: ${errors}`)

  // Final status breakdown
  const { rows: finalStatus } = await pool.query(
    `SELECT mr.status, count(*) FROM match_results mr
     JOIN contacts c ON c.id = mr.contact_id
     WHERE c.campaign_id = $1 GROUP BY mr.status ORDER BY mr.status`,
    [campaignId]
  )
  console.log(`\nFinal match_results status breakdown:`)
  for (const row of finalStatus) {
    console.log(`  ${row.status}: ${row.count}`)
  }

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
