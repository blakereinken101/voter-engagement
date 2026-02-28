#!/usr/bin/env node
/**
 * Seed a Pennsylvania organization + campaign in the database.
 *
 * Creates:
 *   - Organization: "Pennsylvania Campaign" (org-pa)
 *   - Campaign: "PA 2026" (pa-2026) with state=PA
 *   - Admin membership for existing platform admin
 *
 * Optionally links a voter dataset if --dataset=<id> is provided.
 *
 * Usage:
 *   node scripts/seed-pa-campaign.js
 *   node scripts/seed-pa-campaign.js --dataset=vds-abc123
 *
 * Requires DATABASE_URL environment variable.
 */

const { Pool } = require('pg')

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  console.error('Example: DATABASE_URL=postgresql://user:pass@localhost:5432/threshold node scripts/seed-pa-campaign.js')
  process.exit(1)
}

const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({ connectionString: dbUrl, ssl: useSSL })

const ORG_ID = 'org-pa'
const ORG_NAME = 'Pennsylvania Campaign'
const ORG_SLUG = 'pennsylvania'

const CAMPAIGN_ID = 'pa-2026'
const CAMPAIGN_NAME = 'PA 2026'
const CAMPAIGN_SLUG = 'pa-2026'
const CAMPAIGN_STATE = 'PA'
const ELECTION_DATE = '2026-11-03'

// Parse --dataset=<id> arg
const datasetArg = process.argv.find(a => a.startsWith('--dataset='))
const datasetId = datasetArg?.split('=')[1]

async function main() {
  const client = await pool.connect()
  try {
    console.log('=== Seeding PA Campaign ===\n')

    // 1. Create organization
    const { rows: existingOrg } = await client.query(
      'SELECT id FROM organizations WHERE id = $1', [ORG_ID]
    )
    if (existingOrg.length === 0) {
      await client.query(
        `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`,
        [ORG_ID, ORG_NAME, ORG_SLUG]
      )
      console.log(`Created organization: ${ORG_NAME} (${ORG_ID})`)
    } else {
      console.log(`Organization already exists: ${ORG_ID}`)
    }

    // 2. Create campaign
    const { rows: existingCampaign } = await client.query(
      'SELECT id FROM campaigns WHERE id = $1', [CAMPAIGN_ID]
    )
    if (existingCampaign.length === 0) {
      await client.query(
        `INSERT INTO campaigns (id, org_id, name, slug, state, election_date, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [CAMPAIGN_ID, ORG_ID, CAMPAIGN_NAME, CAMPAIGN_SLUG, CAMPAIGN_STATE, ELECTION_DATE, JSON.stringify({
          surveyQuestions: [
            { id: 'top_issue', label: 'Top issue', type: 'select', options: ['Economy', 'Healthcare', 'Education', 'Environment', 'Immigration', 'Housing', 'Crime/Safety', 'Other'] },
            { id: 'vote_plan', label: 'Plan to vote?', type: 'select', options: ['Yes - Election Day', 'Yes - Early voting', 'Yes - By mail', 'Maybe', 'No'] },
            { id: 'needs_ride', label: 'Needs ride to polls?', type: 'select', options: ['Yes', 'No', 'Maybe'] },
          ],
        })]
      )
      console.log(`Created campaign: ${CAMPAIGN_NAME} (${CAMPAIGN_ID}, state=${CAMPAIGN_STATE})`)
    } else {
      console.log(`Campaign already exists: ${CAMPAIGN_ID}`)
    }

    // 3. Find platform admin and create membership
    const { rows: admins } = await client.query(
      'SELECT id, email FROM users WHERE is_platform_admin = true LIMIT 1'
    )
    if (admins.length > 0) {
      const adminId = admins[0].id
      const { rows: existingMembership } = await client.query(
        'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2',
        [adminId, CAMPAIGN_ID]
      )
      if (existingMembership.length === 0) {
        await client.query(
          `INSERT INTO memberships (id, user_id, campaign_id, role) VALUES ($1, $2, $3, 'campaign_admin')`,
          [crypto.randomUUID(), adminId, CAMPAIGN_ID]
        )
        console.log(`Created admin membership for ${admins[0].email} in ${CAMPAIGN_ID}`)
      } else {
        console.log(`Admin already has membership in ${CAMPAIGN_ID}`)
      }
    } else {
      console.log('WARNING: No platform admin found — no membership created')
    }

    // 4. Seed events subscription for PA org
    const { rows: existingSub } = await client.query(
      "SELECT id FROM product_subscriptions WHERE organization_id = $1 AND product = 'events'",
      [ORG_ID]
    )
    if (existingSub.length === 0) {
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      await client.query(
        `INSERT INTO product_subscriptions (id, organization_id, product, plan, status, current_period_start, current_period_end, limits)
         VALUES ($1, $2, 'events', 'starter', 'active', $3, $4, $5)`,
        [crypto.randomUUID(), ORG_ID, now.toISOString(), periodEnd.toISOString(), JSON.stringify({})]
      )
      console.log('Created events subscription for PA org')
    }

    // 5. Link voter dataset if provided
    if (datasetId) {
      const { rows: ds } = await client.query(
        'SELECT id, status, record_count FROM voter_datasets WHERE id = $1', [datasetId]
      )
      if (ds.length === 0) {
        console.error(`WARNING: Dataset ${datasetId} not found`)
      } else {
        await client.query(
          `INSERT INTO campaign_voter_datasets (campaign_id, dataset_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [CAMPAIGN_ID, datasetId]
        )
        console.log(`Linked dataset ${datasetId} (${ds[0].record_count?.toLocaleString()} records, status=${ds[0].status}) to ${CAMPAIGN_ID}`)
      }
    }

    console.log('\nDone! PA campaign is ready.')
    console.log(`  Org: ${ORG_NAME} (${ORG_ID})`)
    console.log(`  Campaign: ${CAMPAIGN_NAME} (${CAMPAIGN_ID})`)
    if (!datasetId) {
      console.log('\nNext: Upload PA voter data via platform admin, then link it:')
      console.log(`  node scripts/seed-pa-campaign.js --dataset=<dataset-id>`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
