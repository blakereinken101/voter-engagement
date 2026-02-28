#!/usr/bin/env node
/**
 * Import a voter dataset JSON file into PostgreSQL via streaming.
 *
 * Handles multi-GB files without loading them into memory by using
 * stream-json to parse one record at a time.
 *
 * Usage:
 *   node scripts/import-voter-dataset.mjs \
 *     --file data/pa-voters-hd91.json \
 *     --name "PA House District 91" \
 *     --state PA \
 *     --geo-type district \
 *     --geo-name "HD-91" \
 *     --assign pa-2026
 *
 * Options:
 *   --file       Path to JSON voter file (required)
 *   --name       Human-readable dataset name (required)
 *   --state      2-letter state code (required)
 *   --geo-type   Geography type: state|county|district|city (default: state)
 *   --geo-name   Geography name, e.g. "Mecklenburg" (optional)
 *   --assign     Campaign ID to auto-assign after import (optional)
 *   --resume     Dataset ID to resume a failed import (optional)
 *
 * Requires DATABASE_URL environment variable.
 */

import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import { randomUUID } from 'crypto'
import pg from 'pg'
import StreamJson from 'stream-json'
import StreamArray from 'stream-json/streamers/StreamArray.js'

const { parser } = StreamJson
const { streamArray } = StreamArray

const { Pool } = pg

// =============================================
// CLI ARGUMENT PARSING
// =============================================

function parseArgs() {
  const args = {}
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=')
      args[key] = rest.length > 0 ? rest.join('=') : true
    }
  }
  return args
}

const args = parseArgs()

if (!args.file || !args.name || !args.state) {
  console.error(`
Usage: node scripts/import-voter-dataset.mjs \\
  --file=data/pa-voters-hd91.json \\
  --name="PA House District 91" \\
  --state=PA \\
  [--geo-type=district] \\
  [--geo-name="HD-91"] \\
  [--assign=campaign-id] \\
  [--resume=vds-existing-id]

Required: --file, --name, --state
Requires DATABASE_URL environment variable.
`)
  process.exit(1)
}

const FILE_PATH = args.file
const DATASET_NAME = args.name
const STATE = String(args.state).toUpperCase()
const GEO_TYPE = args['geo-type'] || 'state'
const GEO_NAME = args['geo-name'] || null
const ASSIGN_CAMPAIGN = args.assign || null
const RESUME_DATASET_ID = args.resume || null

if (!/^[A-Z]{2}$/.test(STATE)) {
  console.error('ERROR: --state must be a 2-letter state code (e.g. PA, NC, CT)')
  process.exit(1)
}

// =============================================
// DATABASE CONNECTION
// =============================================

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({ connectionString: dbUrl, ssl: useSSL, max: 3 })

// =============================================
// UTILITY FUNCTIONS
// =============================================

/** Replicates normalizeName from src/lib/matching.ts */
function normalizeName(name) {
  return name.toLowerCase().trim().replace(/[^a-z\s\-']/g, '').replace(/\s+/g, ' ')
}

/** Format elapsed time */
function elapsed(startMs) {
  const s = ((Date.now() - startMs) / 1000).toFixed(1)
  return `${s}s`
}

/** Format number with commas */
function fmt(n) {
  return n.toLocaleString()
}

/** Format bytes */
function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
}

// =============================================
// INDEX MANAGEMENT
// =============================================

const VOTER_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_voters_dataset_id ON voters(dataset_id)',
  'CREATE INDEX IF NOT EXISTS idx_voters_last_name_norm ON voters(dataset_id, last_name_normalized)',
  'CREATE INDEX IF NOT EXISTS idx_voters_last_name_metaphone ON voters(dataset_id, last_name_metaphone)',
  'CREATE INDEX IF NOT EXISTS idx_voters_zip ON voters(dataset_id, zip)',
  'CREATE INDEX IF NOT EXISTS idx_voters_status ON voters(dataset_id, voter_status)',
  'CREATE INDEX IF NOT EXISTS idx_voters_dataset_voter ON voters(dataset_id, voter_id)',
  'CREATE INDEX IF NOT EXISTS idx_voters_state_house ON voters(dataset_id, state_house_district)',
]

const VOTER_INDEX_NAMES = [
  'idx_voters_dataset_id',
  'idx_voters_last_name_norm',
  'idx_voters_last_name_metaphone',
  'idx_voters_zip',
  'idx_voters_status',
  'idx_voters_dataset_voter',
  'idx_voters_state_house',
]

// GIN index handled separately (requires pg_trgm)
const TRGM_INDEX = 'CREATE INDEX IF NOT EXISTS idx_voters_last_name_trgm ON voters USING gin(last_name_normalized gin_trgm_ops)'

async function dropIndexes() {
  console.log('[indexes] Dropping indexes for faster bulk insert...')
  for (const name of VOTER_INDEX_NAMES) {
    await pool.query(`DROP INDEX IF EXISTS ${name}`)
  }
  await pool.query('DROP INDEX IF EXISTS idx_voters_last_name_trgm')
  console.log('[indexes] Dropped all voter indexes')
}

async function rebuildIndexes() {
  console.log('[indexes] Rebuilding indexes...')
  const start = Date.now()
  for (const sql of VOTER_INDEXES) {
    await pool.query(sql)
  }
  try {
    await pool.query(TRGM_INDEX)
  } catch {
    console.warn('[indexes] Could not create trigram index (pg_trgm extension may not be available)')
  }
  await pool.query('ANALYZE voters')
  console.log(`[indexes] All indexes rebuilt in ${elapsed(start)}`)
}

// =============================================
// BATCH INSERT
// =============================================

const COLUMNS = [
  'dataset_id', 'voter_id', 'first_name', 'last_name', 'date_of_birth', 'gender',
  'residential_address', 'city', 'state', 'zip', 'party_affiliation', 'registration_date', 'voter_status',
  'vh2024g', 'vh2022g', 'vh2020g', 'vh2024p', 'vh2022p', 'vh2020p', 'lat', 'lng',
  'last_name_normalized', 'last_name_metaphone',
  'congressional_district', 'state_senate_district', 'state_house_district',
]

const COLS_PER_ROW = COLUMNS.length // 26
// PostgreSQL limit is 65,535 params. 65535 / 26 = 2520. Use 2000 for safety.
const BATCH_SIZE = 2000

async function insertBatch(datasetId, records, dm) {
  if (records.length === 0) return 0

  const values = []
  const placeholders = []
  let paramIdx = 1

  for (const r of records) {
    const lastName = String(r.last_name || '').trim()
    const lastNameNorm = normalizeName(lastName)
    const lastNameMeta = lastNameNorm ? dm.process(lastNameNorm)[0] || '' : ''

    const row = [
      datasetId,
      String(r.voter_id || `gen-${randomUUID().slice(0, 8)}`),
      String(r.first_name || '').trim(),
      lastName,
      r.date_of_birth || null,
      r.gender || null,
      r.residential_address || null,
      r.city || null,
      r.state || STATE,
      r.zip || null,
      r.party_affiliation || null,
      r.registration_date || null,
      r.voter_status || 'Active',
      r.VH2024G || r.vh2024g || '',
      r.VH2022G || r.vh2022g || '',
      r.VH2020G || r.vh2020g || '',
      r.VH2024P || r.vh2024p || '',
      r.VH2022P || r.vh2022p || '',
      r.VH2020P || r.vh2020p || '',
      r.lat != null ? Number(r.lat) : null,
      r.lng != null ? Number(r.lng) : null,
      lastNameNorm,
      lastNameMeta,
      r.congressional_district || null,
      r.state_senate_district || null,
      r.state_house_district || null,
    ]

    const ph = []
    for (let i = 0; i < COLS_PER_ROW; i++) {
      ph.push(`$${paramIdx++}`)
    }
    placeholders.push(`(${ph.join(', ')})`)
    values.push(...row)
  }

  await pool.query(
    `INSERT INTO voters (${COLUMNS.join(', ')})
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (dataset_id, voter_id) DO NOTHING`,
    values
  )

  return records.length
}

// =============================================
// MAIN
// =============================================

async function main() {
  const startTime = Date.now()

  // Verify file exists
  let fileSize
  try {
    const s = await stat(FILE_PATH)
    fileSize = s.size
  } catch {
    console.error(`ERROR: File not found: ${FILE_PATH}`)
    process.exit(1)
  }

  console.log(`
==============================================
  Voter Dataset Import
==============================================
  File:      ${FILE_PATH} (${fmtBytes(fileSize)})
  Name:      ${DATASET_NAME}
  State:     ${STATE}
  Geography: ${GEO_TYPE}${GEO_NAME ? ` / ${GEO_NAME}` : ''}
  Assign to: ${ASSIGN_CAMPAIGN || '(none)'}
  Resume:    ${RESUME_DATASET_ID || '(new dataset)'}
==============================================
`)

  // Load Double Metaphone
  console.log('[setup] Loading Double Metaphone...')
  const naturalMod = await import('natural')
  const natural = naturalMod.default || naturalMod
  const dm = new natural.DoubleMetaphone()

  // Create or resume dataset
  let datasetId
  if (RESUME_DATASET_ID) {
    datasetId = RESUME_DATASET_ID
    console.log(`[setup] Resuming dataset: ${datasetId}`)
    // Clear existing records for a fresh re-import
    console.log('[setup] Clearing existing records for re-import...')
    await pool.query('DELETE FROM voters WHERE dataset_id = $1', [datasetId])
    await pool.query(
      `UPDATE voter_datasets SET status = 'processing', error_message = NULL, record_count = 0 WHERE id = $1`,
      [datasetId]
    )
  } else {
    datasetId = `vds-${randomUUID().slice(0, 12)}`
    console.log(`[setup] Creating dataset: ${datasetId}`)
    await pool.query(
      `INSERT INTO voter_datasets (id, name, state, geography_type, geography_name, status)
       VALUES ($1, $2, $3, $4, $5, 'processing')`,
      [datasetId, DATASET_NAME, STATE, GEO_TYPE, GEO_NAME]
    )
  }

  // Drop indexes for speed
  await dropIndexes()

  // Stream-parse and insert
  console.log('[import] Starting streaming import...')
  let totalInserted = 0
  let batchNum = 0
  let currentBatch = []

  try {
    await pipeline(
      createReadStream(FILE_PATH),
      parser(),
      streamArray(),
      new Transform({
        objectMode: true,
        async transform({ value }, _encoding, callback) {
          currentBatch.push(value)

          if (currentBatch.length >= BATCH_SIZE) {
            try {
              const count = await insertBatch(datasetId, currentBatch, dm)
              totalInserted += count
              batchNum++
              currentBatch = []

              // Progress log every 10 batches
              if (batchNum % 10 === 0) {
                const mem = process.memoryUsage()
                process.stdout.write(
                  `\r[import] ${fmt(totalInserted)} records | batch ${batchNum} | ${elapsed(startTime)} | heap ${fmtBytes(mem.heapUsed)}`
                )
              }
            } catch (err) {
              callback(err)
              return
            }
          }

          callback()
        },
        async flush(callback) {
          // Insert remaining records
          try {
            if (currentBatch.length > 0) {
              const count = await insertBatch(datasetId, currentBatch, dm)
              totalInserted += count
              batchNum++
            }
            callback()
          } catch (err) {
            callback(err)
          }
        },
      })
    )
  } catch (err) {
    console.error(`\n[ERROR] Import failed after ${fmt(totalInserted)} records:`, err.message)
    await pool.query(
      `UPDATE voter_datasets SET status = 'error', error_message = $2, record_count = $3 WHERE id = $1`,
      [datasetId, String(err.message).slice(0, 500), totalInserted]
    )
    console.log(`[info] Dataset ${datasetId} marked as error. Use --resume=${datasetId} to retry.`)
    await pool.end()
    process.exit(1)
  }

  console.log(`\n[import] Streaming complete: ${fmt(totalInserted)} records in ${batchNum} batches`)

  // Rebuild indexes
  await rebuildIndexes()

  // Mark dataset as ready
  await pool.query(
    `UPDATE voter_datasets SET status = 'ready', record_count = $2 WHERE id = $1`,
    [datasetId, totalInserted]
  )
  console.log(`[done] Dataset ${datasetId} marked as ready`)

  // Auto-assign to campaign if requested
  if (ASSIGN_CAMPAIGN) {
    await pool.query(
      `INSERT INTO campaign_voter_datasets (campaign_id, dataset_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [ASSIGN_CAMPAIGN, datasetId]
    )
    console.log(`[done] Assigned to campaign: ${ASSIGN_CAMPAIGN}`)
  }

  const totalTime = elapsed(startTime)
  const rate = Math.round(totalInserted / ((Date.now() - startTime) / 1000))

  console.log(`
==============================================
  Import Complete
==============================================
  Dataset ID:  ${datasetId}
  Records:     ${fmt(totalInserted)}
  Time:        ${totalTime}
  Rate:        ${fmt(rate)} records/sec
  Status:      ready
${ASSIGN_CAMPAIGN ? `  Assigned to: ${ASSIGN_CAMPAIGN}\n` : ''}==============================================

Next steps:
  1. Go to /platform → Voter Data tab to see the dataset
  2. Expand the row and assign it to campaigns
  3. Or use: node scripts/seed-pa-campaign.js --dataset=${datasetId}
`)

  await pool.end()
}

main().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})
