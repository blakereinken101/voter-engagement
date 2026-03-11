#!/usr/bin/env node
/**
 * Seed "Alaska Coordinated 2026" campaign with realistic PTG mock data.
 *
 * Creates:
 *   - Organization: "Alaska Coordinated 2026"
 *   - Campaign with AI context reflecting AK 2026 races (Peltola Senate, Governor, State Leg)
 *   - 5 regions: Anchorage, Fairbanks/Interior, Mat-Su, Kenai Peninsula, Southeast
 *   - 12 organizers with region assignments
 *   - ~60 volunteers (invited_by organizers)
 *   - ~400 contacts with conversations, outcomes, survey responses
 *   - PTG config with weekly goals (Apr 15 → Jul 1) and organizer % allocations
 *
 * Usage:
 *   node scripts/seed-alaska-coordinated.js
 *
 * Requires DATABASE_URL environment variable.
 */

const { Pool } = require('pg')
const crypto = require('crypto')

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({ connectionString: dbUrl, ssl: useSSL })

// ── Seeded random for reproducibility ─────────────────────────────────
let _seed = 42
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647
  return (_seed - 1) / 2147483646
}
function pick(arr) { return arr[Math.floor(seededRandom() * arr.length)] }
function randInt(min, max) { return Math.floor(seededRandom() * (max - min + 1)) + min }
function chance(pct) { return seededRandom() < pct }

// ── IDs ───────────────────────────────────────────────────────────────
const ORG_ID = 'org-ak-coord'
const CAMPAIGN_ID = 'ak-coordinated-2026'

// ── Alaska regions & organizing structure ─────────────────────────────
const REGIONS = [
  { name: 'Anchorage', weight: 0.35 },       // biggest metro, most organizers
  { name: 'Fairbanks/Interior', weight: 0.18 },
  { name: 'Mat-Su', weight: 0.17 },
  { name: 'Kenai Peninsula', weight: 0.13 },
  { name: 'Southeast', weight: 0.17 },        // Juneau, Sitka, Ketchikan
]

// Organizers — realistic Alaska names (fictional)
const ORGANIZERS = [
  // Anchorage (4 organizers — biggest region)
  { first: 'Tara',    last: 'Nakamura',  region: 'Anchorage' },
  { first: 'Marcus',  last: 'Chen',      region: 'Anchorage' },
  { first: 'Kayla',   last: 'Williams',  region: 'Anchorage' },
  { first: 'James',   last: 'Okafor',    region: 'Anchorage' },
  // Fairbanks/Interior (2)
  { first: 'Nina',    last: 'Pavlov',    region: 'Fairbanks/Interior' },
  { first: 'Derek',   last: 'Yazzie',    region: 'Fairbanks/Interior' },
  // Mat-Su (2)
  { first: 'Lena',    last: 'Sorensen',  region: 'Mat-Su' },
  { first: 'Tyler',   last: 'Begich',    region: 'Mat-Su' },
  // Kenai Peninsula (2)
  { first: 'Megan',   last: 'Halstead',  region: 'Kenai Peninsula' },
  { first: 'Ravi',    last: 'Patel',     region: 'Kenai Peninsula' },
  // Southeast (2)
  { first: 'Sarah',   last: 'Littlefield', region: 'Southeast' },
  { first: 'Joe',     last: 'Katasse',     region: 'Southeast' },
]

// Volunteer name pools
const V_FIRST = ['Alex', 'Morgan', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn', 'Dakota', 'Skyler', 'Juniper', 'Kai', 'Sage', 'River', 'Ash', 'Rowan', 'Harper', 'Finley', 'Emery', 'Blair', 'Kendall', 'Drew', 'Reese', 'Hayden', 'Cameron', 'Shannon', 'Jessie', 'Pat', 'Chris', 'Sam', 'Robin', 'Jamie', 'Leslie', 'Dana', 'Kerry', 'Noel', 'Rene', 'Kim', 'Tracy', 'Val', 'Mel', 'Corey', 'Lee', 'Angel', 'Francis', 'Gale', 'Lynn', 'Terry', 'Bobbie', 'Jan']
const V_LAST = ['Johnson', 'Smith', 'Brown', 'Thompson', 'Garcia', 'Miller', 'Davis', 'Anderson', 'Wilson', 'Moore', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Lee', 'Perez', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Hill', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins']

// Contact name pools (Alaska-flavored)
const C_FIRST = ['Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Barbara', 'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy', 'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley', 'Paul', 'Dorothy', 'Andrew', 'Kimberly', 'Joshua', 'Emily', 'Kenneth', 'Donna', 'Kevin', 'Michelle', 'Brian', 'Carol', 'George', 'Amanda', 'Timothy', 'Melissa', 'Ronald', 'Deborah', 'Edward']
const C_LAST = ['Olson', 'Petersen', 'Ivanov', 'Kvasnikoff', 'Larsen', 'Hensley', 'Tobin', 'Morales', 'Fischer', 'Stepanoff', 'Notti', 'Hopson', 'Simmonds', 'Price', 'Murphy', 'Sullivan', 'James', 'Reed', 'Cook', 'Morgan', 'Bell', 'Gonzalez', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward', 'Torres', 'Gray', 'Ramirez', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson']

// Alaska cities by region
const CITIES = {
  'Anchorage': ['Anchorage', 'Eagle River', 'Girdwood', 'Chugiak'],
  'Fairbanks/Interior': ['Fairbanks', 'North Pole', 'Delta Junction', 'Nenana'],
  'Mat-Su': ['Wasilla', 'Palmer', 'Big Lake', 'Houston'],
  'Kenai Peninsula': ['Kenai', 'Soldotna', 'Homer', 'Seward'],
  'Southeast': ['Juneau', 'Sitka', 'Ketchikan', 'Petersburg'],
}

// Alaska street names for mock voter records
const AK_STREETS = ['Raspberry Rd', 'Northern Lights Blvd', 'Lake Otis Pkwy', 'Tudor Rd', 'Dimond Blvd', 'Spenard Rd', 'Old Seward Hwy', 'Boniface Pkwy', 'Jewel Lake Rd', 'Minnesota Dr', 'Fireweed Ln', 'Benson Blvd', 'DeBarr Rd', 'Muldoon Rd', 'Airport Heights Dr', 'Chena Hot Springs Rd', 'College Rd', 'Geist Rd', 'Johansen Expy', 'Peger Rd', 'Lathrop St', 'Knik-Goose Bay Rd', 'Bogard Rd', 'Palmer-Wasilla Hwy', 'Kenai Spur Hwy', 'Sterling Hwy', 'Egan Dr', 'Glacier Hwy', 'Mendenhall Loop Rd', 'Tongass Ave']
const PARTIES = ['DEM', 'REP', 'UNF', 'NPA', 'LIB', 'GRN']
const PARTY_WEIGHTS = [0.25, 0.30, 0.30, 0.08, 0.04, 0.03]
const VOTER_STATUSES = ['Active', 'Inactive']
const SEGMENTS = ['super-voter', 'sometimes-voter', 'rarely-voter']
const SEGMENT_WEIGHTS = [0.30, 0.45, 0.25]

function pickWeightedParty() {
  const r = seededRandom()
  let cumulative = 0
  for (let i = 0; i < PARTIES.length; i++) {
    cumulative += PARTY_WEIGHTS[i]
    if (r < cumulative) return PARTIES[i]
  }
  return PARTIES[PARTIES.length - 1]
}

function pickWeightedSegment() {
  const r = seededRandom()
  let cumulative = 0
  for (let i = 0; i < SEGMENTS.length; i++) {
    cumulative += SEGMENT_WEIGHTS[i]
    if (r < cumulative) return SEGMENTS[i]
  }
  return SEGMENTS[SEGMENTS.length - 1]
}

function generateVoteHistory() {
  // Generate realistic vote history — super voters vote in most, rarely voters in few
  const vals = ['Y', 'N', 'A', 'E', '']
  return {
    VH2024G: pick(chance(0.70) ? ['Y'] : vals),
    VH2022G: pick(chance(0.55) ? ['Y'] : vals),
    VH2020G: pick(chance(0.75) ? ['Y'] : vals),
    VH2024P: pick(chance(0.30) ? ['Y'] : vals),
    VH2022P: pick(chance(0.25) ? ['Y'] : vals),
    VH2020P: pick(chance(0.35) ? ['Y'] : vals),
  }
}

/**
 * Generate a mock SafeVoterRecord that resembles the contact.
 * For confirmed matches, the name/address closely match.
 * For ambiguous candidates, names are similar but details differ.
 */
function generateMockVoterRecord(firstName, lastName, city, zip, isCloseMatch) {
  const birthYear = String(randInt(1945, 2004))
  const regYear = randInt(2000, 2024)
  const voterAddress = isCloseMatch
    ? `${randInt(100, 9999)} ${pick(AK_STREETS)}`
    : `${randInt(100, 9999)} ${pick(AK_STREETS)}`

  return {
    first_name: isCloseMatch ? firstName : pick(C_FIRST),
    last_name: isCloseMatch ? lastName : (chance(0.6) ? lastName : pick(C_LAST)),
    birth_year: birthYear,
    gender: pick(['M', 'F', 'U']),
    residential_address: voterAddress,
    city: isCloseMatch ? city : pick(['Anchorage', 'Fairbanks', 'Wasilla', 'Juneau', 'Kenai']),
    state: 'AK',
    zip: isCloseMatch ? zip : pick(['99501', '99502', '99503', '99701', '99645', '99801']),
    party_affiliation: pickWeightedParty(),
    registration_date: `${regYear}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`,
    voter_status: chance(0.90) ? 'Active' : 'Inactive',
    ...generateVoteHistory(),
  }
}

/**
 * Generate a mock MatchCandidate with voterRecord, score, confidenceLevel, matchedOn.
 */
function generateMockCandidate(firstName, lastName, city, zip, isTopMatch) {
  const score = isTopMatch
    ? (0.80 + seededRandom() * 0.19)   // 0.80-0.99 for top match
    : (0.55 + seededRandom() * 0.30)   // 0.55-0.85 for other candidates

  const confidenceLevel = score >= 0.90 ? 'high'
    : score >= 0.70 ? 'medium'
    : score >= 0.55 ? 'low'
    : 'very-low'

  const matchedOn = ['exact-name']
  if (chance(0.60)) matchedOn.push('city')
  if (chance(0.40)) matchedOn.push('zip')
  if (chance(0.20)) matchedOn.push('address')
  if (chance(0.15)) matchedOn.push('age-range')

  return {
    voterRecord: generateMockVoterRecord(firstName, lastName, city, zip, isTopMatch),
    score: Math.round(score * 100) / 100,
    confidenceLevel,
    matchedOn,
  }
}

/**
 * Compute a vote score from vote history in a voter record.
 */
function computeVoteScore(voterRecord) {
  const elections = ['VH2024G', 'VH2022G', 'VH2020G', 'VH2024P', 'VH2022P', 'VH2020P']
  let voted = 0
  let total = 0
  for (const e of elections) {
    if (voterRecord[e] && voterRecord[e] !== '') {
      total++
      if (voterRecord[e] === 'Y' || voterRecord[e] === 'E') voted++
    }
  }
  return total > 0 ? Math.round((voted / total) * 100) / 100 : 0.5
}

const CATEGORIES = ['friends', 'neighbors', 'coworkers', 'community', 'faith-community', 'school-pta', 'sports', 'hobby']
const OUTCOMES = ['supporter', 'undecided', 'opposed', 'left-message', 'no-answer']
const OUTCOME_WEIGHTS = [0.35, 0.25, 0.10, 0.15, 0.15]
const OUTREACH_METHODS = ['text', 'call', 'one-on-one']

// Survey questions (Alaska-specific issues)
const SURVEY_QUESTIONS = [
  { id: 'top_issue', label: 'Top issue', options: ['Cost of Living', 'Fishing/Subsistence Rights', 'Energy/Oil Policy', 'Healthcare Access', 'Education', 'Housing', 'PFD/State Budget', 'Infrastructure'] },
  { id: 'peltola_support', label: 'Supporting Peltola for Senate?', options: ['Strong Yes', 'Leaning Yes', 'Undecided', 'Leaning No', 'No'] },
  { id: 'rcv_opinion', label: 'Opinion on RCV?', options: ['Support', 'Oppose', 'Neutral'] },
  { id: 'volunteer_interest', label: 'Interested in volunteering?', options: ['Yes - ready now', 'Maybe later', 'No'] },
]

// ── Generate weeks (Apr 14 → Jun 30, Monday starts) ──────────────────
function generateWeeks() {
  const weeks = []
  const d = new Date('2026-04-13T00:00:00')
  const end = new Date('2026-07-01T00:00:00')
  while (d <= end) {
    weeks.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 7)
  }
  return weeks
}

function pickWeightedOutcome() {
  const r = seededRandom()
  let cumulative = 0
  for (let i = 0; i < OUTCOMES.length; i++) {
    cumulative += OUTCOME_WEIGHTS[i]
    if (r < cumulative) return OUTCOMES[i]
  }
  return OUTCOMES[OUTCOMES.length - 1]
}

function generateSurveyResponse() {
  const resp = {}
  // Not every contact answers every question
  for (const q of SURVEY_QUESTIONS) {
    if (chance(0.6)) {
      resp[q.id] = pick(q.options)
    }
  }
  return Object.keys(resp).length > 0 ? JSON.stringify(resp) : null
}

function randomDate(weekStart) {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + randInt(0, 6))
  d.setHours(randInt(9, 20), randInt(0, 59))
  return d.toISOString()
}

// Simple password hash (bcryptjs-compatible via sync)
let bcrypt
try { bcrypt = require('bcryptjs') } catch { bcrypt = null }
function hashPassword(pw) {
  if (bcrypt) return bcrypt.hashSync(pw, 10)
  // Fallback — won't be login-compatible but seed still works
  return '$2a$10$FAKEHASH' + Buffer.from(pw).toString('base64')
}

async function main() {
  const client = await pool.connect()
  try {
    console.log('=== Seeding Alaska Coordinated 2026 Campaign ===\n')

    // ── 1. Organization ──────────────────────────────────────────────
    const { rows: existingOrg } = await client.query('SELECT id FROM organizations WHERE id = $1', [ORG_ID])
    if (existingOrg.length === 0) {
      await client.query(
        `INSERT INTO organizations (id, name, slug, description) VALUES ($1, $2, $3, $4)`,
        [ORG_ID, 'Alaska Coordinated 2026', 'alaska-coordinated-2026',
         'Alaska Democratic coordinated campaign for 2026 — Senate, House, Governor, and State Legislature races.']
      )
      console.log('Created organization: Alaska Coordinated 2026')
    } else {
      console.log('Organization already exists')
    }

    // ── 2. Campaign ──────────────────────────────────────────────────
    const weeks = generateWeeks()
    const ptgConfig = buildPtgConfig(weeks)
    const campaignSettings = buildCampaignSettings(ptgConfig)

    const { rows: existingCampaign } = await client.query('SELECT id FROM campaigns WHERE id = $1', [CAMPAIGN_ID])
    if (existingCampaign.length === 0) {
      await client.query(
        `INSERT INTO campaigns (id, org_id, name, slug, candidate_name, state, election_date, settings, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [CAMPAIGN_ID, ORG_ID, 'Alaska Coordinated 2026', 'ak-coordinated-2026',
         'Mary Peltola', 'AK', '2026-11-03', JSON.stringify(campaignSettings), 'America/Anchorage']
      )
      console.log('Created campaign: Alaska Coordinated 2026')
    } else {
      await client.query(
        'UPDATE campaigns SET settings = $2, timezone = $3 WHERE id = $1',
        [CAMPAIGN_ID, JSON.stringify(campaignSettings), 'America/Anchorage']
      )
      console.log('Campaign exists — updated settings + PTG config + timezone')
    }

    // ── 3. Product subscriptions ─────────────────────────────────────
    for (const product of ['events', 'relational']) {
      const { rows: sub } = await client.query(
        'SELECT id FROM product_subscriptions WHERE organization_id = $1 AND product = $2',
        [ORG_ID, product]
      )
      if (sub.length === 0) {
        const now = new Date()
        const end = new Date(now); end.setMonth(end.getMonth() + 12)
        await client.query(
          `INSERT INTO product_subscriptions (id, organization_id, product, plan, status, current_period_start, current_period_end, limits)
           VALUES ($1, $2, $3, 'scale', 'active', $4, $5, $6)`,
          [crypto.randomUUID(), ORG_ID, product, now.toISOString(), end.toISOString(),
           JSON.stringify({ maxRsvpsPerMonth: -1, maxTeamMembers: -1, analytics: true, customBranding: true, apiAccess: true, whiteLabel: true })]
        )
        console.log(`  Created ${product} subscription`)
      }
    }

    // ── 4. Platform admin memberships ────────────────────────────────
    const { rows: admins } = await client.query('SELECT id, email FROM users WHERE is_platform_admin = true')
    for (const admin of admins) {
      const { rows: existing } = await client.query(
        'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2', [admin.id, CAMPAIGN_ID]
      )
      if (existing.length === 0) {
        await client.query(
          `INSERT INTO memberships (id, user_id, campaign_id, role) VALUES ($1, $2, $3, 'campaign_admin')`,
          [crypto.randomUUID(), admin.id, CAMPAIGN_ID]
        )
        console.log(`  Admin membership for ${admin.email}`)
      }
    }

    // ── 5. Create organizer users + memberships ──────────────────────
    console.log('\nCreating organizers...')
    const organizerIds = []
    for (const org of ORGANIZERS) {
      const email = `${org.first.toLowerCase()}.${org.last.toLowerCase()}@akcoord26.org`
      const userId = `ak-org-${org.first.toLowerCase()}-${org.last.toLowerCase()}`
      const fullName = `${org.first} ${org.last}`

      const { rows: existingUser } = await client.query('SELECT id FROM users WHERE id = $1', [userId])
      if (existingUser.length === 0) {
        await client.query(
          `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)`,
          [userId, email, hashPassword('alaska2026!'), fullName]
        )
      }

      const { rows: existingMem } = await client.query(
        'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2', [userId, CAMPAIGN_ID]
      )
      if (existingMem.length === 0) {
        await client.query(
          `INSERT INTO memberships (id, user_id, campaign_id, role, region) VALUES ($1, $2, $3, 'organizer', $4)`,
          [crypto.randomUUID(), userId, CAMPAIGN_ID, org.region]
        )
      } else {
        await client.query(
          'UPDATE memberships SET region = $1 WHERE user_id = $2 AND campaign_id = $3',
          [org.region, userId, CAMPAIGN_ID]
        )
      }

      organizerIds.push({ userId, name: fullName, region: org.region })
      console.log(`  ${fullName} → ${org.region}`)
    }

    // ── 5b. Create turfs for each organizer ──────────────────────────
    console.log('\nCreating turfs...')
    const turfIds = {} // organizerId → turfId
    for (const org of organizerIds) {
      const turfId = `turf-${org.userId}`
      const turfName = `${org.name}'s Turf`
      const { rows: existingTurf } = await client.query('SELECT id FROM turfs WHERE id = $1', [turfId])
      if (existingTurf.length === 0) {
        await client.query(
          `INSERT INTO turfs (id, campaign_id, name, organizer_id, region) VALUES ($1, $2, $3, $4, $5)`,
          [turfId, CAMPAIGN_ID, turfName, org.userId, org.region]
        )
      } else {
        await client.query(
          'UPDATE turfs SET name = $1, organizer_id = $2, region = $3 WHERE id = $4',
          [turfName, org.userId, org.region, turfId]
        )
      }
      turfIds[org.userId] = turfId
      console.log(`  ${turfName} → ${org.region}`)
    }

    // ── 6. Create volunteers under each organizer ────────────────────
    console.log('\nCreating volunteers...')
    const volunteersByOrganizer = {}
    let volIdx = 0

    for (const org of organizerIds) {
      const volCount = randInt(4, 7)
      volunteersByOrganizer[org.userId] = []

      for (let i = 0; i < volCount; i++) {
        const first = V_FIRST[volIdx % V_FIRST.length]
        const last = V_LAST[volIdx % V_LAST.length]
        const userId = `ak-vol-${volIdx}`
        const email = `vol${volIdx}@akcoord26.org`
        const fullName = `${first} ${last}`

        const { rows: existingUser } = await client.query('SELECT id FROM users WHERE id = $1', [userId])
        if (existingUser.length === 0) {
          await client.query(
            'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
            [userId, email, hashPassword('volunteer2026'), fullName]
          )
        }

        // Volunteer joined at a random point in the campaign
        const joinWeekIdx = randInt(0, Math.min(3, weeks.length - 1)) // Most join in first few weeks
        const joinDate = randomDate(weeks[joinWeekIdx])

        const { rows: existingMem } = await client.query(
          'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2', [userId, CAMPAIGN_ID]
        )
        if (existingMem.length === 0) {
          await client.query(
            `INSERT INTO memberships (id, user_id, campaign_id, role, invited_by, joined_at) VALUES ($1, $2, $3, 'volunteer', $4, $5)`,
            [crypto.randomUUID(), userId, CAMPAIGN_ID, org.userId, joinDate]
          )
        }

        volunteersByOrganizer[org.userId].push({ userId, name: fullName, joinWeekIdx })
        volIdx++
      }
    }
    console.log(`  Created ${volIdx} volunteers across ${organizerIds.length} organizers`)

    // ── 7. Create contacts + action items (conversations) ────────────
    // Check if match_results has the 'confidence' column (migration 014)
    let hasConfidenceCol = false
    try {
      const { rows: colCheck } = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'match_results' AND column_name = 'confidence'
      `)
      hasConfidenceCol = colCheck.length > 0
    } catch { /* ignore */ }

    console.log('\nCreating contacts & conversations...')
    let contactCount = 0
    let convoCount = 0
    const matchCounts = { confirmed: 0, ambiguous: 0, unmatched: 0, pending: 0 }

    await client.query('BEGIN')
    try {
      for (const org of organizerIds) {
        const vols = volunteersByOrganizer[org.userId]
        const regionCities = CITIES[org.region] || ['Anchorage']

        for (const vol of vols) {
          // Each volunteer has 5-15 contacts
          const numContacts = randInt(5, 15)

          for (let c = 0; c < numContacts; c++) {
            const contactId = crypto.randomUUID()
            const firstName = pick(C_FIRST)
            const lastName = pick(C_LAST)
            const city = pick(regionCities)
            const category = pick(CATEGORIES)
            const phone = `907-${randInt(200,999)}-${String(randInt(1000,9999))}`
            const fullAddress = `${randInt(100, 9999)} ${pick(['Main', 'Spruce', 'Birch', 'Glacier', 'Moose', 'Eagle', 'Salmon', 'Northern Lights'])} ${pick(['St', 'Ave', 'Rd', 'Dr', 'Ln'])}`
            const zip = pick(['99501', '99502', '99503', '99504', '99507', '99508', '99577', '99645', '99654', '99669', '99611', '99801', '99835', '99901'])

            // ~12% of contacts have incomplete addresses (no street address) — these stay pending
            const hasIncompleteAddress = chance(0.12)
            const address = hasIncompleteAddress ? null : fullAddress
            const contactCity = hasIncompleteAddress && chance(0.5) ? null : city

            // Entry method: 70% manual, 15% scan, 10% chatbot, 5% import
            const entryRoll = seededRandom()
            const entryMethod = entryRoll < 0.70 ? 'manual' : entryRoll < 0.85 ? 'scan' : entryRoll < 0.95 ? 'chatbot' : 'import'

            // Entered by: 80% the volunteer themselves, 20% the organizer
            const enteredBySelf = chance(0.80)
            const enteredBy = enteredBySelf ? vol.userId : org.userId

            // Assign to the organizer's turf
            const turfId = turfIds[org.userId]

            await client.query(
              `INSERT INTO contacts (id, user_id, campaign_id, first_name, last_name, phone, address, city, zip, category, entry_method, entered_by, turf_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [contactId, vol.userId, CAMPAIGN_ID, firstName, lastName, phone, address, contactCity, zip, category, entryMethod, enteredBy, turfId]
            )

            // Match result — realistic distribution:
            //   ~45% confirmed (matched to voter file)
            //   ~12% ambiguous (multiple candidates, needs manual resolution)
            //   ~15% unmatched (no match in voter file)
            //   ~28% pending (not yet matched — includes incomplete-address contacts)
            const matchRoll = hasIncompleteAddress ? 1.0 : seededRandom() // incomplete addresses always stay pending
            let matchStatus, bestMatchData, candidatesData, voteScore, segment, confidence, userConfirmed

            if (matchRoll < 0.45) {
              // CONFIRMED — high-confidence match to a voter record
              matchStatus = 'confirmed'
              const voterRecord = generateMockVoterRecord(firstName, lastName, city, zip, true)
              bestMatchData = JSON.stringify(voterRecord)
              voteScore = computeVoteScore(voterRecord)
              segment = pickWeightedSegment()
              confidence = 'high'
              userConfirmed = 1
              // Include the confirmed candidate + 0-1 runners-up
              const topCandidate = generateMockCandidate(firstName, lastName, city, zip, true)
              topCandidate.voterRecord = voterRecord
              topCandidate.score = 0.90 + seededRandom() * 0.09
              topCandidate.confidenceLevel = 'high'
              const allCandidates = [topCandidate]
              if (chance(0.35)) {
                allCandidates.push(generateMockCandidate(firstName, lastName, city, zip, false))
              }
              candidatesData = JSON.stringify(allCandidates)
            } else if (matchRoll < 0.57) {
              // AMBIGUOUS — 2-3 candidates, needs manual pick
              matchStatus = 'ambiguous'
              const numCandidates = chance(0.6) ? 2 : 3
              const allCandidates = []
              for (let ci = 0; ci < numCandidates; ci++) {
                allCandidates.push(generateMockCandidate(firstName, lastName, city, zip, ci === 0))
              }
              candidatesData = JSON.stringify(allCandidates)
              // Top candidate as "best guess" but not user-confirmed
              bestMatchData = JSON.stringify(allCandidates[0].voterRecord)
              voteScore = computeVoteScore(allCandidates[0].voterRecord)
              segment = null
              confidence = allCandidates[0].score >= 0.80 ? 'medium' : 'low'
              userConfirmed = 0
            } else if (matchRoll < 0.72) {
              // UNMATCHED — searched but no match found
              matchStatus = 'unmatched'
              bestMatchData = null
              candidatesData = null
              voteScore = null
              segment = null
              confidence = null
              userConfirmed = 0
            } else {
              // PENDING — not yet matched (maybe newly entered, or needs more info)
              matchStatus = 'pending'
              bestMatchData = null
              candidatesData = null
              voteScore = null
              segment = null
              confidence = null
              userConfirmed = 0
            }

            if (hasConfidenceCol) {
              await client.query(
                `INSERT INTO match_results (id, contact_id, status, best_match_data, candidates_data, vote_score, segment, confidence, user_confirmed)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [crypto.randomUUID(), contactId, matchStatus, bestMatchData, candidatesData, voteScore, segment, confidence, userConfirmed]
              )
            } else {
              await client.query(
                `INSERT INTO match_results (id, contact_id, status, best_match_data, candidates_data, vote_score, segment, user_confirmed)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [crypto.randomUUID(), contactId, matchStatus, bestMatchData, candidatesData, voteScore, segment, userConfirmed]
              )
            }
            matchCounts[matchStatus]++

            // Has this contact been contacted? Probability increases with time
            const contacted = chance(0.65) // 65% contacted
            if (contacted) {
              // Pick a random week after the volunteer joined
              const weekIdx = randInt(vol.joinWeekIdx, weeks.length - 1)
              const contactedDate = randomDate(weeks[weekIdx])
              const outcome = pickWeightedOutcome()
              const method = pick(OUTREACH_METHODS)
              const survey = generateSurveyResponse()
              const volInterest = chance(0.15) ? 'yes' : chance(0.10) ? 'maybe' : 'no'

              await client.query(
                `INSERT INTO action_items (id, contact_id, contacted, contacted_date, outreach_method, contact_outcome, volunteer_interest, survey_responses, entry_method, entered_by)
                 VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)`,
                [crypto.randomUUID(), contactId, contactedDate, method, outcome, volInterest, survey, entryMethod, enteredBy]
              )
              convoCount++
            } else {
              await client.query(
                `INSERT INTO action_items (id, contact_id, contacted) VALUES ($1, $2, 0)`,
                [crypto.randomUUID(), contactId]
              )
            }
            contactCount++
          }
        }
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }

    console.log(`  Created ${contactCount} contacts, ${convoCount} conversations`)
    console.log(`  Match statuses: ${matchCounts.confirmed} confirmed, ${matchCounts.ambiguous} ambiguous, ${matchCounts.unmatched} unmatched, ${matchCounts.pending} pending`)

    // ── 8. Update PTG allocations with actual organizer IDs ──────────
    ptgConfig.allocations = buildAllocations(organizerIds, weeks)
    const updatedSettings = { ...campaignSettings, ptgConfig }
    await client.query(
      `UPDATE campaigns SET settings = $2 WHERE id = $1`,
      [CAMPAIGN_ID, JSON.stringify(updatedSettings)]
    )
    console.log('\nUpdated PTG config with organizer allocations')

    // ── Done ─────────────────────────────────────────────────────────
    console.log('\n=== Alaska Coordinated 2026 is ready! ===')
    console.log(`  Campaign ID: ${CAMPAIGN_ID}`)
    console.log(`  Regions: ${REGIONS.map(r => r.name).join(', ')}`)
    console.log(`  Organizers: ${organizerIds.length}`)
    console.log(`  Volunteers: ${volIdx}`)
    console.log(`  Contacts: ${contactCount}`)
    console.log(`  Conversations: ${convoCount}`)
    console.log(`  PTG weeks: ${weeks.length} (${weeks[0]} → ${weeks[weeks.length - 1]})`)
    console.log('\nSign in as admin and switch to "Alaska Coordinated 2026" to see the PTG.')

  } finally {
    client.release()
    await pool.end()
  }
}

// ── PTG Config builders ──────────────────────────────────────────────

function buildPtgConfig(weeks) {
  // Realistic ramping goals — start smaller, build as organizers ramp up
  const numWeeks = weeks.length

  const convGoals = weeks.map((_, i) => {
    const base = 80
    const ramp = Math.floor(base + (i / numWeeks) * 120) // 80 → 200
    return ramp + randInt(-5, 5)
  })

  const activeGoals = weeks.map((_, i) => {
    const base = 15
    const ramp = Math.floor(base + (i / numWeeks) * 35) // 15 → 50
    return ramp + randInt(-2, 2)
  })

  const recruitedGoals = weeks.map((_, i) => {
    // Higher early (recruitment push), then levels off
    const base = i < 4 ? 12 : 8
    return base + randInt(-2, 2)
  })

  const completedGoals = weeks.map((_, i) => {
    const base = 10
    const ramp = Math.floor(base + (i / numWeeks) * 25) // 10 → 35
    return ramp + randInt(-2, 2)
  })

  return {
    weeks,
    metrics: {
      volunteers_active: { totalGoals: activeGoals, activeThreshold: 5 },
      volunteers_recruited: { totalGoals: recruitedGoals },
      volunteers_completed: { totalGoals: completedGoals, completedThreshold: 3 },
      conversations: { totalGoals: convGoals },
    },
    allocations: {}, // filled in after organizer IDs are known
  }
}

function buildAllocations(organizerIds, weeks) {
  const allocations = {}
  // Group organizers by region and assign % based on region weight
  const byRegion = {}
  for (const org of organizerIds) {
    if (!byRegion[org.region]) byRegion[org.region] = []
    byRegion[org.region].push(org.userId)
  }

  for (let wi = 0; wi < weeks.length; wi++) {
    // Each region gets its weight %, divided among organizers in that region
    let totalPct = 0
    const pcts = {}
    for (const region of REGIONS) {
      const orgIds = byRegion[region.name] || []
      if (orgIds.length === 0) continue
      const regionPct = Math.round(region.weight * 100)
      const perOrg = Math.floor(regionPct / orgIds.length)
      const remainder = regionPct - perOrg * orgIds.length

      orgIds.forEach((id, i) => {
        pcts[id] = perOrg + (i === 0 ? remainder : 0)
        totalPct += pcts[id]
      })
    }

    // Normalize to 100%
    const diff = 100 - totalPct
    if (diff !== 0) {
      const firstId = organizerIds[0].userId
      pcts[firstId] = (pcts[firstId] || 0) + diff
    }

    for (const [id, pct] of Object.entries(pcts)) {
      if (!allocations[id]) allocations[id] = []
      allocations[id][wi] = pct
    }
  }

  return allocations
}

function buildCampaignSettings(ptgConfig) {
  return {
    surveyQuestions: SURVEY_QUESTIONS.map(q => ({
      id: q.id,
      label: q.label,
      type: 'select',
      options: q.options,
    })),
    aiContext: {
      goals: 'Win the 2026 Alaska coordinated campaign: elect Mary Peltola to U.S. Senate, win the Governor\'s race, hold the House majority coalition, and expand the Senate coalition. Build a statewide relational organizing program reaching every community in Alaska.',
      keyIssues: [
        'Cost of living and inflation in Alaska',
        'Fishing and subsistence rights',
        'Energy policy and Permanent Fund Dividend',
        'Healthcare access in rural communities',
        'Education funding and teacher retention',
        'Housing affordability',
        'Infrastructure and rural broadband',
        'Protecting ranked-choice voting',
      ],
      talkingPoints: [
        'Mary Peltola has proven she can win statewide by focusing on Alaska issues, not DC politics.',
        'The coalition majority in the legislature has delivered real results — protecting the PFD, investing in schools, and expanding healthcare access.',
        'Every conversation matters in Alaska. With ranked-choice voting, building broad coalitions is how we win.',
        'Our relational organizing program reaches communities that traditional campaigns miss — from Barrow to Ketchikan.',
        'Alaska\'s future depends on leaders who understand our unique challenges — distance, weather, subsistence, and the cost of living.',
      ],
      messagingGuidance: 'Lead with shared Alaskan values — self-reliance, community, protecting our way of life. Avoid national partisan framing. Emphasize practical results over ideology. In rural communities, lead with subsistence and cost of living. In Anchorage/Fairbanks, lead with housing, healthcare, and education. Always mention ranked-choice voting as an advantage — Alaskans can vote their values without worry.',
      campaignType: 'candidate',
      goalPriorities: ['volunteer-recruitment', 'voter-turnout', 'persuasion'],
      candidateInfo: {
        name: 'Mary Peltola',
        party: 'Democratic',
        office: 'U.S. Senate',
      },
      electionInfo: {
        date: '2026-11-03',
        state: 'AK',
      },
      partyStrategies: {
        DEM: 'Rally the base around protecting the coalition majority and electing Peltola to Senate. Emphasize the stakes — this is our best chance to hold the legislature and win a Senate seat.',
        REP: 'Lead with Peltola\'s bipartisan record and her work on fishing and subsistence issues. Many Alaska Republicans respect her — focus on issues, not party.',
        UNF: 'Alaska has the highest share of independents in the nation. Emphasize that our candidates are independent-minded and focused on Alaska, not party bosses in DC.',
      },
    },
    ptgConfig,
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
