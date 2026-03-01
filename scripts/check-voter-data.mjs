#!/usr/bin/env node
/**
 * Diagnostic script: check voter data configuration for all campaigns.
 *
 * Reports which campaigns have voter data properly configured (DB dataset
 * or settings.voterFile) and which are misconfigured (would fail matching).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/check-voter-data.mjs
 *   # or
 *   npm run check:voter-data
 *
 * Options:
 *   --fix    Auto-fix campaigns by setting settings.voterFile when a
 *            unique state-matched file is found in data/
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const shouldFix = process.argv.includes('--fix')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  console.log('Checking voter data configuration for all campaigns...\n')

  // 1. List all campaigns
  const { rows: campaigns } = await pool.query(`
    SELECT c.id, c.name, c.state, c.candidate_name, c.settings, o.name as org_name
    FROM campaigns c
    JOIN organizations o ON o.id = c.org_id
    WHERE c.is_active = true
    ORDER BY c.name
  `)

  if (campaigns.length === 0) {
    console.log('No active campaigns found.')
    await pool.end()
    return
  }

  // 2. List all DB datasets and their assignments
  const { rows: datasets } = await pool.query(`
    SELECT vd.id, vd.name, vd.state, vd.record_count, vd.status
    FROM voter_datasets vd
    ORDER BY vd.name
  `)

  const { rows: assignments } = await pool.query(`
    SELECT cvd.campaign_id, cvd.dataset_id, vd.name as dataset_name,
           vd.state as dataset_state, vd.record_count, vd.status,
           cvd.filter_congressional, cvd.filter_state_senate,
           cvd.filter_state_house, cvd.filter_city, cvd.filter_zip
    FROM campaign_voter_datasets cvd
    JOIN voter_datasets vd ON vd.id = cvd.dataset_id
  `)

  // 3. Scan data/ directory for voter files
  const voterFiles = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir)
        .filter(f => f.endsWith('.json') && f.includes('voter'))
        .map(f => ({
          name: f,
          size: fs.statSync(path.join(dataDir, f)).size,
          // Infer state from filename prefix (e.g., ny-voters-*.json → NY)
          state: f.match(/^([a-z]{2})-/)?.[1]?.toUpperCase() || null,
        }))
    : []

  console.log(`Found ${campaigns.length} active campaign(s), ${datasets.length} DB dataset(s), ${voterFiles.length} voter file(s) on disk.\n`)

  // 4. Check each campaign
  let okCount = 0
  let warnCount = 0
  const fixes = []

  for (const campaign of campaigns) {
    const settings = campaign.settings || {}
    const voterFile = settings.voterFile || null

    // Check DB dataset assignment
    const campaignAssignments = assignments.filter(a => a.campaign_id === campaign.id)
    const readyAssignment = campaignAssignments.find(a => a.status === 'ready')

    // Check file-based fallback
    const fileExists = voterFile
      ? fs.existsSync(path.join(dataDir, voterFile))
      : false

    // Check auto-discoverable files for this state
    const stateFiles = voterFiles.filter(f => f.state === campaign.state)

    // Determine status
    let status
    let detail

    if (readyAssignment) {
      if (readyAssignment.record_count > 0) {
        status = 'OK'
        detail = `DB dataset "${readyAssignment.dataset_name}" (${readyAssignment.record_count.toLocaleString()} records)`
      } else {
        status = 'WARN'
        detail = `DB dataset "${readyAssignment.dataset_name}" exists but has 0 records`
      }
    } else if (campaignAssignments.length > 0) {
      const a = campaignAssignments[0]
      status = 'WARN'
      detail = `DB dataset "${a.dataset_name}" assigned but status is '${a.status}' (not 'ready')`
    } else if (voterFile && fileExists) {
      const size = fs.statSync(path.join(dataDir, voterFile)).size
      status = 'OK'
      detail = `File: ${voterFile} (${(size / 1024 / 1024).toFixed(1)} MB)`
    } else if (voterFile && !fileExists) {
      status = 'FAIL'
      detail = `settings.voterFile = "${voterFile}" but file not found in ${dataDir}`
    } else if (stateFiles.length === 1) {
      status = 'WARN'
      detail = `No config, but auto-discoverable: ${stateFiles[0].name} (${(stateFiles[0].size / 1024 / 1024).toFixed(1)} MB)`
      if (shouldFix) {
        fixes.push({ campaignId: campaign.id, voterFile: stateFiles[0].name })
      }
    } else if (stateFiles.length > 1) {
      status = 'FAIL'
      detail = `No config. Multiple ${campaign.state} files found: ${stateFiles.map(f => f.name).join(', ')}. Set settings.voterFile to choose one.`
    } else {
      // Check if legacy fallback would incorrectly match
      const legacyNC = campaign.state === 'NC' && voterFiles.some(f =>
        f.name.startsWith('mecklenburg-voters')
      )
      if (legacyNC) {
        status = 'OK'
        const f = voterFiles.find(f => f.name === 'mecklenburg-voters-geo.json') ||
                  voterFiles.find(f => f.name === 'mecklenburg-voters.json')
        detail = `Legacy NC fallback: ${f?.name} (${((f?.size || 0) / 1024 / 1024).toFixed(1)} MB)`
      } else {
        status = 'FAIL'
        detail = 'No DB dataset, no settings.voterFile, and no auto-discoverable file.'
      }
    }

    const icon = status === 'OK' ? 'OK  ' : status === 'WARN' ? 'WARN' : 'FAIL'
    console.log(`[${icon}] ${campaign.name} (${campaign.id}, state: ${campaign.state})`)
    console.log(`       ${detail}`)

    if (status === 'FAIL' || status === 'WARN') warnCount++
    else okCount++
  }

  // 5. Apply fixes if --fix flag was passed
  if (fixes.length > 0) {
    console.log(`\nApplying ${fixes.length} fix(es)...`)
    for (const fix of fixes) {
      await pool.query(
        `UPDATE campaigns SET settings = settings || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ voterFile: fix.voterFile }), fix.campaignId]
      )
      console.log(`  Set settings.voterFile = "${fix.voterFile}" for campaign ${fix.campaignId}`)
    }
  }

  // 6. Summary
  console.log(`\n--- Summary ---`)
  console.log(`  ${okCount} campaign(s) OK`)
  console.log(`  ${warnCount} campaign(s) need attention`)

  if (warnCount > 0 && !shouldFix) {
    console.log(`\nRun with --fix to auto-set settings.voterFile where a unique state file exists.`)
    console.log(`For campaigns with multiple files, manually set settings.voterFile in the DB:`)
    console.log(`  UPDATE campaigns SET settings = settings || '{"voterFile":"filename.json"}'::jsonb WHERE id = 'campaign-id';`)
  }

  await pool.end()
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
