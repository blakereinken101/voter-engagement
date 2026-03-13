#!/usr/bin/env node
/**
 * Update voter records with voting history + phone from a Reach/VAN export.
 *
 * Usage:
 *   node scripts/update-voter-history.mjs --file /path/to/ReachExport.zip
 *
 * Updates:
 *   - vh2024g, vh2022g, vh2020g (General24, General22, General20)
 *   - vh2024p, vh2022p, vh2020p (Primary24, Primary22, Primary20)
 *   - preferred_phone
 *   - extra_data (all other voting history + metadata merged in)
 *
 * Requires DATABASE_URL environment variable.
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import pg from 'pg'

const { Pool } = pg

// ── CLI ──────────────────────────────────────────────
const zipPath = process.argv.find((a, i) => process.argv[i - 1] === '--file')
if (!zipPath) {
  console.error('Usage: node scripts/update-voter-history.mjs --file <zip-path>')
  process.exit(1)
}

// ── Extract & decode ─────────────────────────────────
console.log(`[history] Extracting ${zipPath}...`)
const tmpDir = join(tmpdir(), 'voter-history-' + Date.now())
execSync(`mkdir -p "${tmpDir}" && unzip -o "${zipPath}" -d "${tmpDir}"`)
const extractedFiles = execSync(`ls "${tmpDir}"/`).toString().trim().split('\n')
const dataFile = extractedFiles.find(f => f.endsWith('.txt') || f.endsWith('.xls'))
if (!dataFile) {
  console.error('[history] No .txt or .xls file found in archive')
  process.exit(1)
}
const filePath = join(tmpDir, dataFile)
console.log(`[history] Reading ${filePath}...`)
const raw = readFileSync(filePath)
const text = raw.toString('utf16le')
execSync(`rm -rf "${tmpDir}"`)

const lines = text.split(/\r?\n/).filter(l => l.trim())
const header = lines[0].split('\t').map(h => h.replace(/^\uFEFF/, '').trim())
const vanidIdx = header.findIndex(h => h === 'Voter File VANID')

if (vanidIdx === -1) {
  console.error('[history] Could not find Voter File VANID column. Found:', header)
  process.exit(1)
}

// Map Reach columns → DB columns
const DIRECT_MAP = {
  'General24': 'vh2024g',
  'General22': 'vh2022g',
  'General20': 'vh2020g',
  'Primary24': 'vh2024p',
  'Primary22': 'vh2022p',
  'Primary20': 'vh2020p',
}

// Columns to skip when building extra_data (already in voters table or unneeded)
const SKIP_EXTRA = new Set([
  'Voter File VANID', 'mAddress', 'mCity', 'mState', 'mZip5',
  'LastName', 'FirstName', 'MiddleName', 'Suffix', 'DOB', 'Sex', 'Party',
  'CD', 'SD', 'HD', 'CountyName', 'PrecinctName',
  'Preferred Phone', 'CellPhoneIsCell', 'HomePhoneIsCell',
  // Direct-mapped voting history
  'General24', 'General22', 'General20', 'Primary24', 'Primary22', 'Primary20',
])

// Build column index lookups
const colIdx = {}
for (const [reachCol] of Object.entries(DIRECT_MAP)) {
  colIdx[reachCol] = header.indexOf(reachCol)
}
const phoneIdx = header.indexOf('Preferred Phone')

// Voting history columns for extra_data
const historyColIndices = []
for (let i = 0; i < header.length; i++) {
  if (!SKIP_EXTRA.has(header[i])) {
    historyColIndices.push(i)
  }
}

console.log(`[history] Found ${lines.length - 1} rows`)
console.log(`[history] Direct-mapped columns:`, Object.keys(DIRECT_MAP).filter(k => colIdx[k] !== -1))
console.log(`[history] Extra data columns: ${historyColIndices.length}`)

// ── Parse records ────────────────────────────────────
const records = []
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t')
  const vanid = (cols[vanidIdx] || '').trim()
  if (!vanid) continue

  const rec = { vanid }

  // Direct-mapped voting history
  for (const [reachCol, dbCol] of Object.entries(DIRECT_MAP)) {
    const idx = colIdx[reachCol]
    if (idx !== -1) {
      rec[dbCol] = (cols[idx] || '').trim()
    }
  }

  // Phone
  if (phoneIdx !== -1) {
    const phone = (cols[phoneIdx] || '').trim().replace(/\D/g, '')
    if (phone.length >= 7) {
      rec.phone = phone
    }
  }

  // Extra data — all other voting history + metadata
  const extra = {}
  for (const idx of historyColIndices) {
    const val = (cols[idx] || '').trim()
    if (val) {
      extra[header[idx]] = val
    }
  }
  rec.extra = extra

  records.push(rec)
}

console.log(`[history] ${records.length} valid records parsed`)

// ── Database update (batched for speed) ──────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
})

// Use a temp table approach for fast bulk update
console.log('[history] Creating temp table...')
await pool.query(`
  CREATE TEMP TABLE IF NOT EXISTS voter_history_import (
    voter_id TEXT PRIMARY KEY,
    vh2024g TEXT,
    vh2022g TEXT,
    vh2020g TEXT,
    vh2024p TEXT,
    vh2022p TEXT,
    vh2020p TEXT,
    preferred_phone TEXT,
    extra_data JSONB
  )
`)

// Insert records into temp table in batches
const BATCH = 500
for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH)
  const params = []
  const valueParts = []
  let pIdx = 1

  for (const rec of batch) {
    valueParts.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8})`)
    params.push(
      rec.vanid,
      rec.vh2024g || '',
      rec.vh2022g || '',
      rec.vh2020g || '',
      rec.vh2024p || '',
      rec.vh2022p || '',
      rec.vh2020p || '',
      rec.phone || null,
      JSON.stringify(rec.extra || {})
    )
    pIdx += 9
  }

  await pool.query(
    `INSERT INTO voter_history_import (voter_id, vh2024g, vh2022g, vh2020g, vh2024p, vh2022p, vh2020p, preferred_phone, extra_data)
     VALUES ${valueParts.join(', ')}
     ON CONFLICT (voter_id) DO UPDATE SET
       vh2024g = EXCLUDED.vh2024g,
       vh2022g = EXCLUDED.vh2022g,
       vh2020g = EXCLUDED.vh2020g,
       vh2024p = EXCLUDED.vh2024p,
       vh2022p = EXCLUDED.vh2022p,
       vh2020p = EXCLUDED.vh2020p,
       preferred_phone = EXCLUDED.preferred_phone,
       extra_data = EXCLUDED.extra_data`,
    params
  )

  if ((i + BATCH) % 5000 < BATCH) {
    console.log(`[history] Loaded ${Math.min(i + BATCH, records.length)}/${records.length} into temp table`)
  }
}

console.log(`[history] Loaded all ${records.length} records into temp table`)

// Single UPDATE join to apply all changes at once
console.log('[history] Applying bulk update to voters table...')
const result = await pool.query(`
  UPDATE voters v
  SET
    vh2024g = CASE WHEN t.vh2024g != '' THEN t.vh2024g ELSE v.vh2024g END,
    vh2022g = CASE WHEN t.vh2022g != '' THEN t.vh2022g ELSE v.vh2022g END,
    vh2020g = CASE WHEN t.vh2020g != '' THEN t.vh2020g ELSE v.vh2020g END,
    vh2024p = CASE WHEN t.vh2024p != '' THEN t.vh2024p ELSE v.vh2024p END,
    vh2022p = CASE WHEN t.vh2022p != '' THEN t.vh2022p ELSE v.vh2022p END,
    vh2020p = CASE WHEN t.vh2020p != '' THEN t.vh2020p ELSE v.vh2020p END,
    preferred_phone = COALESCE(t.preferred_phone, v.preferred_phone),
    extra_data = COALESCE(v.extra_data, '{}'::jsonb) || t.extra_data
  FROM voter_history_import t
  WHERE v.voter_id = t.voter_id
`)

console.log(`[history] Done! ${result.rowCount} voters updated`)

await pool.query('DROP TABLE IF EXISTS voter_history_import')
await pool.end()
