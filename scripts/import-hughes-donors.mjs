#!/usr/bin/env node
/**
 * Import donors from Anedot CSV export into the Hughes campaign as contacts.
 *
 * Usage:
 *   node scripts/import-hughes-donors.mjs --file=/path/to/donors.csv
 *
 * Filters to CT residents in Easton, Weston, Redding (HD-135 towns) by default.
 * Use --all-towns to import donors from all towns.
 *
 * Requires DATABASE_URL environment variable.
 */

import pg from 'pg'
import { randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import Papa from 'papaparse'

const { Pool } = pg

// ── Args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const fileArg = args.find(a => a.startsWith('--file='))
const allTowns = args.includes('--all-towns')
const dryRun = args.includes('--dry-run')

if (!fileArg) {
  console.error('Usage: node scripts/import-hughes-donors.mjs --file=<csv-path> [--all-towns] [--dry-run]')
  process.exit(1)
}

const csvPath = fileArg.replace('--file=', '')

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({ connectionString: dbUrl, ssl: useSSL, max: 3 })

// HD-135 towns (case-insensitive matching)
const TARGET_TOWNS = new Set(['easton', 'weston', 'redding'])

const ORG_SLUG = 'hughes-for-rep'
const CAMPAIGN_SLUG = 'hughes-2026'

// ── Parse CSV ────────────────────────────────────────────────────────
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = []
    const stream = createReadStream(filePath, 'utf-8')

    Papa.parse(stream, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    })
  })
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Hughes Campaign — Donor Import ===\n')

  // 1. Find campaign
  const { rows: campaigns } = await pool.query(
    `SELECT c.id FROM campaigns c
     JOIN organizations o ON o.id = c.org_id
     WHERE c.slug = $1 AND o.slug = $2`,
    [CAMPAIGN_SLUG, ORG_SLUG]
  )

  if (campaigns.length === 0) {
    console.error('ERROR: Hughes campaign not found. Run seed-hughes-campaign.mjs first.')
    process.exit(1)
  }

  const campaignId = campaigns[0].id
  console.log(`[campaign] Found: ${campaignId}`)

  // 2. Find a user for this campaign (campaign admin or first member)
  let userId
  const { rows: members } = await pool.query(
    `SELECT user_id FROM memberships WHERE campaign_id = $1 AND is_active = true ORDER BY role ASC LIMIT 1`,
    [campaignId]
  )

  if (members.length > 0) {
    userId = members[0].user_id
    console.log(`[user] Found campaign member: ${userId}`)
  } else {
    // Fall back to Blake's account and create a membership
    const { rows: users } = await pool.query(
      `SELECT id, name FROM users WHERE email = $1`,
      ['blakereinken@optimum.net']
    )
    if (users.length === 0) {
      // Fall back to any user
      const { rows: anyUser } = await pool.query('SELECT id, name FROM users LIMIT 1')
      if (anyUser.length === 0) {
        console.error('ERROR: No users found. Create a user first.')
        process.exit(1)
      }
      userId = anyUser[0].id
    } else {
      userId = users[0].id
    }

    // Create membership
    await pool.query(
      `INSERT INTO memberships (id, user_id, campaign_id, role, is_active)
       VALUES ($1, $2, $3, 'campaign_admin', true)
       ON CONFLICT (user_id, campaign_id) DO NOTHING`,
      [randomUUID(), userId, campaignId]
    )
    console.log(`[user] Created campaign_admin membership for: ${userId}`)

    // Also update user's default campaign
    await pool.query('UPDATE users SET campaign_id = $1 WHERE id = $2 AND campaign_id IS NULL', [campaignId, userId])
  }

  // 3. Parse CSV
  const rows = await parseCSV(csvPath)
  console.log(`[csv] Parsed ${rows.length} rows`)

  // 4. Filter and deduplicate
  const seen = new Set()
  const donors = []

  for (const row of rows) {
    const firstName = (row['First Name'] || '').trim()
    const lastName = (row['Last Name'] || '').trim()
    const city = (row['City'] || '').trim()
    const state = (row['State'] || '').trim()
    const zip = (row['Zip'] || '').trim()
    const phone = (row['Phone'] || '').trim()
    const email = (row['Email'] || '').trim()
    const address = (row['Address Line 1'] || '').trim()

    if (!firstName || !lastName) continue
    if (state.toUpperCase() !== 'CT') continue

    // Filter to target towns unless --all-towns
    if (!allTowns && !TARGET_TOWNS.has(city.toLowerCase())) continue

    // Dedup by name + zip
    const key = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${zip}`
    if (seen.has(key)) continue
    seen.add(key)

    donors.push({ firstName, lastName, city, zip, phone, email, address })
  }

  console.log(`[filter] ${donors.length} unique donors from ${allTowns ? 'all towns' : 'Easton/Weston/Redding'}`)

  if (dryRun) {
    console.log('\n[dry-run] Would import:')
    for (const d of donors) {
      console.log(`  ${d.firstName} ${d.lastName} — ${d.city}, CT ${d.zip}`)
    }
    await pool.end()
    return
  }

  // 5. Check for existing contacts (avoid duplicates)
  const { rows: existing } = await pool.query(
    `SELECT LOWER(first_name) || '-' || LOWER(last_name) as name_key
     FROM contacts WHERE campaign_id = $1`,
    [campaignId]
  )
  const existingNames = new Set(existing.map(r => r.name_key))

  // 6. Insert contacts in batches
  let imported = 0
  let skipped = 0

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const donor of donors) {
      const nameKey = `${donor.firstName.toLowerCase()}-${donor.lastName.toLowerCase()}`
      if (existingNames.has(nameKey)) {
        skipped++
        continue
      }

      const contactId = randomUUID()

      await client.query(`
        INSERT INTO contacts (id, user_id, campaign_id, first_name, last_name, phone, address, city, zip, category, entry_method, entered_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $2)
      `, [contactId, userId, campaignId, donor.firstName, donor.lastName,
          donor.phone || null, donor.address || null, donor.city || null,
          donor.zip ? donor.zip.replace(/[^0-9]/g, '').slice(0, 5) : null,
          'supporters', 'import'])

      await client.query(`
        INSERT INTO match_results (id, contact_id, status)
        VALUES ($1, $2, 'pending')
      `, [randomUUID(), contactId])

      await client.query(`
        INSERT INTO action_items (id, contact_id)
        VALUES ($1, $2)
      `, [randomUUID(), contactId])

      existingNames.add(nameKey)
      imported++
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  console.log(`
==============================================
  Import Complete
==============================================
  Campaign:   Hughes 2026 (${campaignId})
  Imported:   ${imported} donors
  Skipped:    ${skipped} (already exist)
  Total:      ${donors.length}
  Category:   supporters
  Entry:      import

  Next: Contacts will auto-match against voter file
  when volunteers load the app.
==============================================`)

  await pool.end()
}

main().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})
