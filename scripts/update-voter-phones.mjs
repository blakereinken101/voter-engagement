#!/usr/bin/env node
/**
 * Update voter preferred_phone from a Reach/VAN export ZIP file.
 *
 * Usage:
 *   node scripts/update-voter-phones.mjs --file /path/to/ReachExport.zip
 *
 * The ZIP should contain a single UTF-16LE tab-delimited file with columns:
 *   "Voter File VANID" and "Preferred Phone"
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
  console.error('Usage: node scripts/update-voter-phones.mjs --file <zip-path>')
  process.exit(1)
}

// ── Extract & decode ─────────────────────────────────
console.log(`[phones] Extracting ${zipPath}...`)
const tmpDir = join(tmpdir(), 'voter-phones-' + Date.now())
execSync(`mkdir -p "${tmpDir}" && unzip -o "${zipPath}" -d "${tmpDir}"`)
const extractedFile = execSync(`ls "${tmpDir}"/*.txt`).toString().trim()
console.log(`[phones] Reading ${extractedFile}...`)
const raw = readFileSync(extractedFile)
const text = raw.toString('utf16le')
execSync(`rm -rf "${tmpDir}"`)


const lines = text.split(/\r?\n/).filter(l => l.trim())
const header = lines[0].split('\t').map(h => h.replace(/^\uFEFF/, '').trim())
const vanidIdx = header.findIndex(h => h === 'Voter File VANID')
const phoneIdx = header.findIndex(h => h === 'Preferred Phone')

if (vanidIdx === -1 || phoneIdx === -1) {
  console.error('[phones] Could not find required columns. Found:', header)
  process.exit(1)
}

console.log(`[phones] Found ${lines.length - 1} rows, VANID col=${vanidIdx}, Phone col=${phoneIdx}`)

// Parse records with phone numbers
const updates = []
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t')
  const vanid = (cols[vanidIdx] || '').trim()
  const phone = (cols[phoneIdx] || '').trim()
  if (vanid && phone) {
    // Normalize phone to digits only
    const digits = phone.replace(/\D/g, '')
    if (digits.length >= 7) {
      updates.push({ vanid, phone: digits })
    }
  }
}

console.log(`[phones] ${updates.length} records have valid phone numbers`)

// ── Database update ──────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const BATCH = 500
let updated = 0
let skipped = 0

for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH)

  // Build a VALUES list for batch update
  const params = []
  const valueParts = []
  for (let j = 0; j < batch.length; j++) {
    const pIdx = j * 2
    params.push(batch[j].vanid, batch[j].phone)
    valueParts.push(`($${pIdx + 1}, $${pIdx + 2})`)
  }

  const result = await pool.query(`
    UPDATE voters v
    SET preferred_phone = t.phone
    FROM (VALUES ${valueParts.join(', ')}) AS t(voter_id, phone)
    WHERE v.voter_id = t.voter_id
      AND (v.preferred_phone IS NULL OR v.preferred_phone != t.phone)
  `, params)

  updated += result.rowCount
  skipped += batch.length - result.rowCount

  if ((i + BATCH) % 5000 < BATCH) {
    console.log(`[phones] Progress: ${Math.min(i + BATCH, updates.length)}/${updates.length} processed, ${updated} updated`)
  }
}

console.log(`[phones] Done! ${updated} voters updated, ${skipped} already had correct phone or not found`)

await pool.end()
