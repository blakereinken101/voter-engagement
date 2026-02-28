#!/usr/bin/env node
/**
 * Process Pennsylvania Full Voter Export (FVE) data.
 *
 * The PA FVE is TAB-delimited with 154 columns per voter, with double-quoted
 * text fields. Delivered as one FVE file + one Election Map file per county
 * (67 counties). Files live in data/Statewide/.
 *
 * Layout (0-indexed columns):
 *   0: voter_id          12: house_number      25: date_last_voted
 *   2: last_name         14: street_name       26: precinct_code
 *   3: first_name        17: city              35: state_house (STH prefix)
 *   6: gender            18: state             36: state_senate (STS prefix)
 *   7: DOB               19: zip               37: congressional (USC prefix)
 *   8: reg_date          20-24: mail addr      70-149: vote history (40 elections × 2)
 *   9: status            150: phone            151: county_name
 *   11: party
 *
 * Vote history: 40 election slots, each = 2 columns (method, party).
 *   Base column = 70. Election index N → cols (70 + (N-1)*2, 71 + (N-1)*2).
 *   Election indices are defined per-county in "[COUNTY] Election Map" files.
 *   Methods: AP = At Polls, MB = Mail Ballot, AB = Absentee.
 *
 * Modes:
 *   Statewide:  node scripts/process-pa-voter-data.js
 *               → data/pa-voters.json (streams to disk, low memory)
 *
 *   By district: node scripts/process-pa-voter-data.js --district=91
 *                → data/pa-voters-hd91.json (only house district 91)
 *
 *   By county:  node scripts/process-pa-voter-data.js --county=Philadelphia
 *
 *   With limit: node scripts/process-pa-voter-data.js --limit=50000
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const DATA_DIR = path.join(__dirname, '..', 'data')
const STATEWIDE_DIR = path.join(DATA_DIR, 'Statewide')

// ─── Column positions (0-indexed) ───────────────────────────────────
const COL = {
  voter_id: 0,
  last_name: 2,
  first_name: 3,
  middle_name: 4,
  suffix: 5,
  gender: 6,
  dob: 7,
  reg_date: 8,
  status: 9,
  party: 11,
  house_number: 12,
  house_suffix: 13,
  street_name: 14,
  city: 17,
  state: 18,
  zip: 19,
  date_last_voted: 25,
  state_house: 35,
  state_senate: 36,
  congressional: 37,
  phone: 150,
  county_name: 151,
}

const VH_BASE = 70        // First vote history column (idx 1 → col 70)
const VH_MAX_IDX = 40     // Max election index (40 elections × 2 cols = cols 70-149)

// Target elections we want to extract (matched by date in Election Map)
const TARGET_DATES = {
  '11/05/2024': 'VH2024G',
  '11/08/2022': 'VH2022G',
  '11/03/2020': 'VH2020G',
  '04/23/2024': 'VH2024P',
  '05/17/2022': 'VH2022P',
  '06/02/2020': 'VH2020P',
}

// ─── Parse args ─────────────────────────────────────────────────────
const args = process.argv.slice(2)
const countyFilter = args.find(a => a.startsWith('--county='))?.split('=')[1]
const districtFilter = args.find(a => a.startsWith('--district='))?.split('=')[1]
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const RECORD_LIMIT = limitArg ? parseInt(limitArg) : 0

// Output file depends on mode
const OUTPUT_FILE = districtFilter
  ? path.join(DATA_DIR, `pa-voters-hd${districtFilter}.json`)
  : path.join(DATA_DIR, 'pa-voters.json')

// ─── Party mapping ──────────────────────────────────────────────────
const PARTY_MAP = {
  'D': 'DEM',
  'R': 'REP',
  'L': 'LIB',
  'LN': 'LIB',
  'G': 'GRN',
  'GR': 'GRN',
  'NF': 'IND',
  'NO': 'IND',
  'IND': 'IND',
}

function mapParty(code) {
  if (!code) return 'UNR'
  const trimmed = code.trim().toUpperCase()
  return PARTY_MAP[trimmed] || 'OTH'
}

function titleCase(str) {
  if (!str) return ''
  return str.trim().toLowerCase().replace(/(?:^|\s|-)\S/g, a => a.toUpperCase())
}

function convertDate(mmddyyyy) {
  if (!mmddyyyy) return ''
  const parts = mmddyyyy.trim().split('/')
  if (parts.length !== 3) return ''
  const [mm, dd, yyyy] = parts
  if (!yyyy || yyyy.length !== 4) return ''
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function stripQuotes(s) {
  if (!s) return ''
  return s.replace(/^"|"$/g, '').trim()
}

function stripDistrictPrefix(code) {
  if (!code) return null
  // STH091 → 91, STS33 → 33, USC13 → 13
  const match = code.match(/^(?:STH|STS|USC|SC|TS|MD|CO)0*(\d+)$/)
  return match ? match[1] : code.replace(/^0+/, '') || null
}

function mapVotingMethod(method) {
  if (!method) return 'Y'
  const upper = method.trim().toUpperCase()
  if (upper === 'MB' || upper === 'AB') return 'A'  // Mail Ballot / Absentee
  return 'Y'  // AP (At Polls) or anything else
}

// ─── Read Election Map for a county ─────────────────────────────────
function readElectionMap(countyName) {
  const files = fs.readdirSync(STATEWIDE_DIR)
  const mapFile = files.find(f =>
    f.toUpperCase().startsWith(countyName.toUpperCase()) &&
    f.toLowerCase().includes('election map')
  )

  if (!mapFile) {
    console.log(`  WARNING: No election map found for ${countyName}`)
    return null
  }

  const content = fs.readFileSync(path.join(STATEWIDE_DIR, mapFile), 'utf-8')
  const lines = content.trim().split(/\r?\n/)

  const result = {}
  for (const line of lines) {
    const parts = line.split('\t').map(stripQuotes)
    const idx = parseInt(parts[1])
    const date = parts[3]

    if (isNaN(idx) || idx < 1 || idx > VH_MAX_IDX) continue

    const field = TARGET_DATES[date]
    if (field) {
      result[field] = idx
    }
  }

  return result
}

// ─── Streaming JSON writer ──────────────────────────────────────────
// Writes JSON array records one at a time to avoid holding all in memory
class StreamingJsonWriter {
  constructor(filePath) {
    this.stream = fs.createWriteStream(filePath)
    this.count = 0
    this.stream.write('[\n')
  }

  write(record) {
    if (this.count > 0) this.stream.write(',\n')
    this.stream.write(JSON.stringify(record))
    this.count++
  }

  close() {
    return new Promise((resolve) => {
      this.stream.end('\n]', resolve)
    })
  }
}

// ─── Process one FVE file ───────────────────────────────────────────
async function processCountyFile(filePath, electionMap, writer, stats) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let count = 0

  // Pre-compute VH column positions for this county's target elections
  const vhCols = {}
  if (electionMap) {
    for (const [field, idx] of Object.entries(electionMap)) {
      vhCols[field] = VH_BASE + (idx - 1) * 2
    }
  }

  for await (const line of rl) {
    if (RECORD_LIMIT && stats.written >= RECORD_LIMIT) break

    const fields = line.split('\t').map(stripQuotes)
    if (fields.length < 100) continue

    // Status filter: only Active voters
    const status = fields[COL.status].toUpperCase()
    if (status !== 'A') {
      stats.skippedInactive++
      count++
      continue
    }

    const voterId = fields[COL.voter_id]
    if (!voterId) { count++; continue }

    const firstName = fields[COL.first_name]
    const lastName = fields[COL.last_name]
    if (!firstName || !lastName) { count++; continue }

    // Districts — strip prefixes (STH091 → 91)
    const houseDist = stripDistrictPrefix(fields[COL.state_house])
    const senateDist = stripDistrictPrefix(fields[COL.state_senate])
    const congDist = stripDistrictPrefix(fields[COL.congressional])

    // District filter
    if (districtFilter && houseDist !== districtFilter) {
      count++
      stats.skippedDistrict++
      continue
    }

    // Build address from components
    const addrParts = [
      fields[COL.house_number],
      fields[COL.house_suffix],
      fields[COL.street_name],
    ].filter(Boolean).join(' ')

    // Vote history from election map
    const vh = {
      VH2024G: 'N', VH2022G: 'N', VH2020G: 'N',
      VH2024P: 'N', VH2022P: 'N', VH2020P: 'N',
    }
    for (const [field, col] of Object.entries(vhCols)) {
      const method = fields[col]
      if (method) {
        vh[field] = mapVotingMethod(method)
      }
    }

    const record = {
      voter_id: voterId,
      first_name: titleCase(firstName),
      last_name: titleCase(lastName),
      date_of_birth: convertDate(fields[COL.dob]),
      gender: fields[COL.gender]?.toUpperCase() === 'M' ? 'M'
        : fields[COL.gender]?.toUpperCase() === 'F' ? 'F' : 'U',
      residential_address: titleCase(addrParts),
      city: titleCase(fields[COL.city]),
      state: 'PA',
      zip: (fields[COL.zip] || '').slice(0, 5),
      party_affiliation: mapParty(fields[COL.party]),
      registration_date: convertDate(fields[COL.reg_date]),
      voter_status: 'Active',
      ...vh,
      congressional_district: congDist,
      state_senate_district: senateDist,
      state_house_district: houseDist,
    }

    writer.write(record)
    stats.written++

    // Track stats in memory (lightweight counters only)
    const city = record.city
    stats.cities.set(city, (stats.cities.get(city) || 0) + 1)
    if (houseDist) stats.houseDists.add(houseDist)
    if (senateDist) stats.senateDists.add(senateDist)
    if (congDist) stats.congDists.add(congDist)
    if (record.VH2024G !== 'N') stats.vh2024g++
    if (record.VH2022G !== 'N') stats.vh2022g++
    if (record.VH2020G !== 'N') stats.vh2020g++

    count++
    if (count % 100000 === 0) {
      process.stdout.write(`  Processed ${count.toLocaleString()} records...\r`)
    }
  }

  return count
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('=== Pennsylvania Voter File Processor ===\n')

  if (districtFilter) console.log(`Mode: House District ${districtFilter}`)
  else console.log('Mode: Statewide')

  if (!fs.existsSync(STATEWIDE_DIR)) {
    console.error(`ERROR: Data directory not found: ${STATEWIDE_DIR}`)
    console.error('Place the PA FVE files in data/Statewide/')
    process.exit(1)
  }

  // Find all FVE files
  const allFiles = fs.readdirSync(STATEWIDE_DIR)
  let fveFiles = allFiles.filter(f => f.includes('FVE') && f.endsWith('.txt'))

  if (fveFiles.length === 0) {
    console.error('ERROR: No FVE .txt files found in', STATEWIDE_DIR)
    process.exit(1)
  }

  // Apply county filter
  if (countyFilter) {
    const lowerFilter = countyFilter.toLowerCase()
    fveFiles = fveFiles.filter(f => f.toLowerCase().startsWith(lowerFilter))
    if (fveFiles.length === 0) {
      console.error(`ERROR: No files match county filter "${countyFilter}"`)
      process.exit(1)
    }
  }

  fveFiles.sort()
  console.log(`Found ${fveFiles.length} county file(s)`)
  if (countyFilter) console.log(`  Filtered to: ${countyFilter}`)
  if (RECORD_LIMIT) console.log(`  Record limit: ${RECORD_LIMIT.toLocaleString()}`)
  console.log(`  Output: ${OUTPUT_FILE}`)

  // Streaming writer — avoids holding all records in memory
  const writer = new StreamingJsonWriter(OUTPUT_FILE)

  let totalProcessed = 0
  const stats = {
    written: 0,
    skippedInactive: 0,
    skippedDistrict: 0,
    cities: new Map(),
    houseDists: new Set(),
    senateDists: new Set(),
    congDists: new Set(),
    vh2024g: 0,
    vh2022g: 0,
    vh2020g: 0,
  }

  for (const file of fveFiles) {
    const countyName = file.replace(/\s*FVE.*$/i, '').trim()
    console.log(`\nProcessing: ${countyName}`)

    const electionMap = readElectionMap(countyName)
    if (electionMap) {
      const found = Object.keys(electionMap).length
      console.log(`  Election map: ${found}/6 target elections found`)
    }

    const filePath = path.join(STATEWIDE_DIR, file)
    const count = await processCountyFile(filePath, electionMap, writer, stats)
    totalProcessed += count
    console.log(`  ${countyName}: ${count.toLocaleString()} rows → ${stats.written.toLocaleString()} active voters total`)

    if (RECORD_LIMIT && stats.written >= RECORD_LIMIT) {
      console.log(`\nReached record limit of ${RECORD_LIMIT.toLocaleString()}`)
      break
    }
  }

  // Close the streaming writer
  await writer.close()

  // Stats
  console.log('\n=== Summary ===')
  console.log(`Total rows processed: ${totalProcessed.toLocaleString()}`)
  console.log(`Active voters written: ${stats.written.toLocaleString()}`)
  console.log(`Skipped (inactive): ${stats.skippedInactive.toLocaleString()}`)
  if (districtFilter) {
    console.log(`Skipped (other districts): ${stats.skippedDistrict.toLocaleString()}`)
  }

  // Top cities
  console.log('\nTop 15 cities:')
  const topCities = [...stats.cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  for (const [city, count] of topCities) {
    console.log(`  ${city}: ${count.toLocaleString()}`)
  }

  // District stats
  console.log(`\nDistricts found:`)
  console.log(`  Congressional: ${stats.congDists.size}`)
  console.log(`  State Senate: ${stats.senateDists.size}`)
  console.log(`  State House: ${stats.houseDists.size}`)

  // VH stats
  const total = stats.written || 1
  console.log(`\nVote history:`)
  console.log(`  Voted in 2024 General: ${stats.vh2024g.toLocaleString()} (${(stats.vh2024g/total*100).toFixed(1)}%)`)
  console.log(`  Voted in 2022 General: ${stats.vh2022g.toLocaleString()} (${(stats.vh2022g/total*100).toFixed(1)}%)`)
  console.log(`  Voted in 2020 General: ${stats.vh2020g.toLocaleString()} (${(stats.vh2020g/total*100).toFixed(1)}%)`)

  const fileSize = fs.statSync(OUTPUT_FILE).size
  console.log(`\nOutput: ${OUTPUT_FILE} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`)
  console.log('\nDone! Next steps:')
  console.log('  1. Geocode: node scripts/geocode-voter-file.js (update INPUT/OUTPUT paths for PA)')
  console.log('  2. Upload via platform admin or seed script')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
