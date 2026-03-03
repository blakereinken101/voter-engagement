#!/usr/bin/env node
/**
 * Process NC State Board of Elections STATEWIDE voter data.
 *
 * Downloads and processes:
 *   - ncvoter_Statewide.zip (voter registration)
 *   - ncvhis_Statewide.zip  (voter history)
 *
 * Outputs: data/nc-voters-statewide.json
 *
 * Usage: node scripts/process-nc-statewide-voter-data.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const readline = require('readline')

const DATA_DIR = path.join(__dirname, '..', 'data')
const VOTER_ZIP = path.join(DATA_DIR, 'ncvoter_Statewide.zip')
const HISTORY_ZIP = path.join(DATA_DIR, 'ncvhis_Statewide.zip')
const OUTPUT_FILE = path.join(DATA_DIR, 'nc-voters-statewide.json')

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
    if (count % 500000 === 0) {
      process.stdout.write(`  Processed ${count.toLocaleString()} records...\r`)
    }
  }
  console.log(`  Processed ${count.toLocaleString()} records total.`)
  return count
}

async function main() {
  console.log('=== NC Statewide Voter Data Processor ===\n')

  // Check for zip files — download if missing
  if (!fs.existsSync(VOTER_ZIP)) {
    console.log('Voter registration zip not found. Downloading statewide file (this may take a while)...')
    execSync(`curl -L -o "${VOTER_ZIP}" "https://s3.amazonaws.com/dl.ncsbe.gov/data/ncvoter_Statewide.zip"`, { stdio: 'inherit', timeout: 600000 })
  } else {
    console.log('Voter registration zip already exists, skipping download.')
  }
  if (!fs.existsSync(HISTORY_ZIP)) {
    console.log('Voter history zip not found. Downloading statewide file (this may take a while)...')
    execSync(`curl -L -o "${HISTORY_ZIP}" "https://s3.amazonaws.com/dl.ncsbe.gov/data/ncvhis_Statewide.zip"`, { stdio: 'inherit', timeout: 600000 })
  } else {
    console.log('Voter history zip already exists, skipping download.')
  }

  // Unzip
  console.log('\n1. Extracting voter registration file...')
  execSync(`cd "${DATA_DIR}" && unzip -o ncvoter_Statewide.zip`, { stdio: 'inherit', timeout: 300000 })

  console.log('\n2. Extracting voter history file...')
  execSync(`cd "${DATA_DIR}" && unzip -o ncvhis_Statewide.zip`, { stdio: 'inherit', timeout: 300000 })

  // Find the extracted files
  const files = fs.readdirSync(DATA_DIR)
  const voterFile = files.find(f => f.startsWith('ncvoter_Statewide') && f.endsWith('.txt'))
  const historyFile = files.find(f => f.startsWith('ncvhis_Statewide') && f.endsWith('.txt'))

  if (!voterFile) { console.error('Could not find statewide voter registration txt file!'); process.exit(1) }
  if (!historyFile) { console.error('Could not find statewide voter history txt file!'); process.exit(1) }

  const voterPath = path.join(DATA_DIR, voterFile)
  const historyPath = path.join(DATA_DIR, historyFile)

  console.log(`\nVoter file: ${voterFile}`)
  console.log(`History file: ${historyFile}`)

  // Step 1: Build vote history map from history file
  console.log('\n3. Processing voter history (statewide — this will take several minutes)...')
  const voteHistory = new Map() // ncid → { VH2024G: 'Y', ... }

  await processLineByLine(historyPath, (h) => {
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

  // Step 2: Process voter registration file — stream-write JSON to avoid OOM
  console.log('\n4. Processing voter registrations (statewide — streaming to JSON)...')
  let totalRecords = 0
  let skippedInactive = 0
  let skippedConfidential = 0
  const cities = new Map()

  const writeStream = fs.createWriteStream(OUTPUT_FILE)
  writeStream.write('[\n')
  let firstRecord = true

  await processLineByLine(voterPath, (h) => {
    console.log(`  Voter columns: ${h.length}`)
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

    // District assignments
    const congDist = (record.cong_dist_abbrv || '').trim()
    const senateDist = (record.nc_senate_abbrv || '').trim()
    const houseDist = (record.nc_house_abbrv || '').trim()

    const voterRecord = {
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
      congressional_district: congDist || null,
      state_senate_district: senateDist || null,
      state_house_district: houseDist || null,
    }

    // Stream-write to avoid loading all records in memory
    if (!firstRecord) writeStream.write(',\n')
    writeStream.write(JSON.stringify(voterRecord))
    firstRecord = false

    totalRecords++
    const titleCity = titleCase(city)
    cities.set(titleCity, (cities.get(titleCity) || 0) + 1)
  })

  writeStream.write('\n]')
  writeStream.end()

  // Wait for write to finish
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })

  console.log(`\n  Active voters: ${totalRecords.toLocaleString()}`)
  console.log(`  Skipped (inactive/removed): ${skippedInactive.toLocaleString()}`)
  console.log(`  Skipped (confidential): ${skippedConfidential.toLocaleString()}`)

  // Stats
  console.log('\n  Top 20 cities:')
  const topCities = [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [city, count] of topCities) {
    console.log(`    ${city}: ${count.toLocaleString()}`)
  }

  const fileSize = fs.statSync(OUTPUT_FILE).size
  console.log(`\n5. Output: ${OUTPUT_FILE}`)
  console.log(`   Records: ${totalRecords.toLocaleString()}`)
  console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`)

  // Clean up extracted txt files (keep zips for re-processing)
  console.log('\n6. Cleaning up extracted files...')
  for (const f of fs.readdirSync(DATA_DIR)) {
    if ((f.startsWith('ncvoter_Statewide') || f.startsWith('ncvhis_Statewide')) && f.endsWith('.txt')) {
      fs.unlinkSync(path.join(DATA_DIR, f))
      console.log(`  Removed ${f}`)
    }
  }

  console.log('\nDone! Statewide voter data ready at data/nc-voters-statewide.json')
  console.log(`\nNext: Import into database:`)
  console.log(`  node scripts/import-voter-dataset.mjs \\`)
  console.log(`    --file=data/nc-voters-statewide.json \\`)
  console.log(`    --name="NC Statewide" \\`)
  console.log(`    --state=NC \\`)
  console.log(`    --geo-type=state \\`)
  console.log(`    --assign=selena-meyer-2026`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
