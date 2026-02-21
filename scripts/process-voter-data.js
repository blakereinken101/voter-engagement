#!/usr/bin/env node
/**
 * Process NC State Board of Elections voter data for Mecklenburg County.
 *
 * NOTE: This script is NC-specific. For other states, you'll need a similar
 * script tailored to that state's voter file format. The output format should
 * match the VoterRecord interface in src/types/index.ts. Save the output as
 * "voters.json" (or "voters-geo.json" if geocoded) in the data/ directory.
 *
 * Downloads and processes:
 *   - ncvoter60.zip (voter registration)
 *   - ncvhis60.zip (voter history)
 *
 * Outputs: data/mecklenburg-voters.json
 *
 * Usage: node scripts/process-voter-data.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const readline = require('readline')

const DATA_DIR = path.join(__dirname, '..', 'data')
const VOTER_ZIP = path.join(DATA_DIR, 'ncvoter60.zip')
const HISTORY_ZIP = path.join(DATA_DIR, 'ncvhis60.zip')
const OUTPUT_FILE = path.join(DATA_DIR, 'mecklenburg-voters.json')

// Election dates to match against voter history
const ELECTION_MAP = {
  // General elections
  '11/05/2024': 'VH2024G',
  '11/08/2022': 'VH2022G',
  '11/03/2020': 'VH2020G',
  // Primary elections - NC primary dates
  '03/05/2024': 'VH2024P',
  '05/17/2022': 'VH2022P',
  '03/03/2020': 'VH2020P',
}

// Party code mapping
const PARTY_MAP = {
  'DEM': 'DEM',
  'REP': 'REP',
  'LIB': 'LIB',
  'GRN': 'GRN',
  'UNA': 'IND',  // Unaffiliated → Independent
  'CST': 'OTH',  // Constitution
  'NLB': 'OTH',  // Natural Law
  'REF': 'OTH',  // Reform
}

function titleCase(str) {
  if (!str) return ''
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, a => a.toUpperCase())
}

function mapParty(code) {
  if (!code) return 'UNR'
  const trimmed = code.trim().toUpperCase()
  return PARTY_MAP[trimmed] || 'OTH'
}

function convertDate(mmddyyyy) {
  if (!mmddyyyy || mmddyyyy.includes('x')) return ''
  const parts = mmddyyyy.split('/')
  if (parts.length !== 3) return ''
  const [mm, dd, yyyy] = parts
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function mapVotingMethod(method) {
  if (!method) return 'Y'
  const upper = method.trim().toUpperCase()
  if (upper === 'ABSENTEE' || upper === 'ABSENTEE-BY-MAIL' || upper === 'ABSENTEE BY MAIL') return 'A'
  if (upper === 'ABSENTEE ONESTOP' || upper === 'ABSENTEE-ONESTOP' || upper.includes('EARLY')) return 'E'
  return 'Y' // IN-PERSON or any other method
}

async function processLineByLine(filePath, headerCallback, lineCallback) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let headers = null
  let count = 0

  for await (const line of rl) {
    if (!headers) {
      headers = line.split('\t').map(h => h.trim().replace(/"/g, ''))
      if (headerCallback) headerCallback(headers)
      continue
    }
    const fields = line.split('\t').map(f => f.trim().replace(/^"|"$/g, ''))
    const record = {}
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = fields[i] || ''
    }
    lineCallback(record)
    count++
    if (count % 100000 === 0) {
      process.stdout.write(`  Processed ${count.toLocaleString()} records...\r`)
    }
  }
  console.log(`  Processed ${count.toLocaleString()} records total.`)
  return count
}

async function main() {
  console.log('=== Mecklenburg County Voter Data Processor ===\n')

  // Check for zip files
  if (!fs.existsSync(VOTER_ZIP)) {
    console.log('Voter registration zip not found. Downloading...')
    execSync(`curl -L -o "${VOTER_ZIP}" "https://s3.amazonaws.com/dl.ncsbe.gov/data/ncvoter60.zip"`, { stdio: 'inherit' })
  }
  if (!fs.existsSync(HISTORY_ZIP)) {
    console.log('Voter history zip not found. Downloading...')
    execSync(`curl -L -o "${HISTORY_ZIP}" "https://s3.amazonaws.com/dl.ncsbe.gov/data/ncvhis60.zip"`, { stdio: 'inherit' })
  }

  // Unzip
  console.log('\n1. Extracting voter registration file...')
  execSync(`cd "${DATA_DIR}" && unzip -o ncvoter60.zip`, { stdio: 'inherit' })

  console.log('\n2. Extracting voter history file...')
  execSync(`cd "${DATA_DIR}" && unzip -o ncvhis60.zip`, { stdio: 'inherit' })

  // Find the extracted files
  const files = fs.readdirSync(DATA_DIR)
  const voterFile = files.find(f => f.startsWith('ncvoter') && f.endsWith('.txt'))
  const historyFile = files.find(f => f.startsWith('ncvhis') && f.endsWith('.txt'))

  if (!voterFile) { console.error('Could not find voter registration txt file!'); process.exit(1) }
  if (!historyFile) { console.error('Could not find voter history txt file!'); process.exit(1) }

  const voterPath = path.join(DATA_DIR, voterFile)
  const historyPath = path.join(DATA_DIR, historyFile)

  console.log(`\nVoter file: ${voterFile}`)
  console.log(`History file: ${historyFile}`)

  // Step 1: Build vote history map from history file
  console.log('\n3. Processing voter history...')
  const voteHistory = new Map() // ncid → { VH2024G: 'Y', ... }

  let histHeaders = null
  await processLineByLine(historyPath, (h) => {
    histHeaders = h
    console.log(`  History columns: ${h.length} (looking for: ncid, election_lbl, voting_method)`)
  }, (record) => {
    const ncid = record.ncid || record.NCID || ''
    const electionDate = record.election_lbl || ''
    const votingMethod = record.voting_method || ''

    if (!ncid || !electionDate) return

    const electionField = ELECTION_MAP[electionDate]
    if (!electionField) return // Not one of our 6 tracked elections

    if (!voteHistory.has(ncid)) {
      voteHistory.set(ncid, {
        VH2024G: 'N', VH2022G: 'N', VH2020G: 'N',
        VH2024P: 'N', VH2022P: 'N', VH2020P: 'N',
      })
    }

    const vh = voteHistory.get(ncid)
    vh[electionField] = mapVotingMethod(votingMethod)
  })

  console.log(`  Vote history loaded for ${voteHistory.size.toLocaleString()} voters.`)

  // Step 2: Process voter registration file
  console.log('\n4. Processing voter registrations...')
  const voters = []
  let skippedInactive = 0
  let skippedConfidential = 0

  await processLineByLine(voterPath, (h) => {
    console.log(`  Voter columns: ${h.length}`)
    // Log first few column names to verify structure
    console.log(`  First 10 columns: ${h.slice(0, 10).join(', ')}`)
  }, (record) => {
    // Only active voters
    const statusCd = (record.status_cd || record.voter_status_desc || '').trim().toUpperCase()
    if (statusCd !== 'A' && statusCd !== 'ACTIVE') {
      skippedInactive++
      return
    }

    // Skip confidential records
    if ((record.confidential_ind || '').trim().toUpperCase() === 'Y') {
      skippedConfidential++
      return
    }

    const ncid = (record.ncid || '').trim()
    if (!ncid) return

    const firstName = record.first_name || ''
    const lastName = record.last_name || ''
    if (!firstName || !lastName) return
    // Skip records with masked names
    if (firstName.includes('#') || lastName.includes('#')) return

    const birthYear = (record.birth_year || '').trim()
    const zip = (record.zip_code || '').trim().slice(0, 5)
    const city = (record.res_city_desc || '').trim()
    const address = (record.res_street_address || '').trim()

    // Get vote history for this voter
    const vh = voteHistory.get(ncid) || {
      VH2024G: 'N', VH2022G: 'N', VH2020G: 'N',
      VH2024P: 'N', VH2022P: 'N', VH2020P: 'N',
    }

    const regDate = convertDate((record.registr_dt || '').trim())

    voters.push({
      voter_id: ncid,
      first_name: titleCase(firstName),
      last_name: titleCase(lastName),
      date_of_birth: birthYear ? `${birthYear}-01-01` : '',
      gender: (record.gender_code || 'U').trim().toUpperCase() === 'M' ? 'M'
        : (record.gender_code || 'U').trim().toUpperCase() === 'F' ? 'F' : 'U',
      residential_address: titleCase(address),
      city: titleCase(city),
      state: 'NC',
      zip: zip,
      party_affiliation: mapParty((record.party_cd || '').trim()),
      registration_date: regDate,
      voter_status: 'Active',
      ...vh,
    })
  })

  console.log(`\n  Active voters: ${voters.length.toLocaleString()}`)
  console.log(`  Skipped (inactive/removed): ${skippedInactive.toLocaleString()}`)
  console.log(`  Skipped (confidential): ${skippedConfidential.toLocaleString()}`)

  // Stats
  const cities = new Map()
  for (const v of voters) {
    cities.set(v.city, (cities.get(v.city) || 0) + 1)
  }
  console.log('\n  Top cities:')
  const topCities = [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  for (const [city, count] of topCities) {
    console.log(`    ${city}: ${count.toLocaleString()}`)
  }

  // Check Huntersville specifically
  const huntersville = voters.filter(v => v.city.toLowerCase() === 'huntersville')
  console.log(`\n  Huntersville voters: ${huntersville.length.toLocaleString()}`)
  const charlotte = voters.filter(v => v.city.toLowerCase() === 'charlotte')
  console.log(`  Charlotte voters: ${charlotte.length.toLocaleString()}`)

  // Write output
  console.log(`\n5. Writing ${voters.length.toLocaleString()} records to ${OUTPUT_FILE}...`)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(voters))

  const fileSize = fs.statSync(OUTPUT_FILE).size
  console.log(`  Output size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`)

  // Clean up extracted txt files (keep zips for re-processing)
  console.log('\n6. Cleaning up extracted files...')
  for (const f of files) {
    if ((f.startsWith('ncvoter') || f.startsWith('ncvhis')) && f.endsWith('.txt')) {
      fs.unlinkSync(path.join(DATA_DIR, f))
      console.log(`  Removed ${f}`)
    }
  }

  console.log('\nDone! Voter data ready at data/mecklenburg-voters.json')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
