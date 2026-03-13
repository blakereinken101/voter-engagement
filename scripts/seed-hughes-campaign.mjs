#!/usr/bin/env node
/**
 * Seed script: Create the Anne Hughes for State Representative campaign.
 *
 * Creates:
 *   1. Organization: "Anne Hughes for State Representative"
 *   2. Campaign: "Anne Hughes for State Representative" (CT HD-135, Easton/Redding/Weston)
 *   3. Campaign settings with AI context, fundraising config, and survey questions
 *
 * Usage:
 *   node scripts/seed-hughes-campaign.mjs
 *
 * Requires DATABASE_URL environment variable.
 * Idempotent — re-running updates settings if the campaign already exists.
 */

import pg from 'pg'
import { randomUUID } from 'crypto'

const { Pool } = pg

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({ connectionString: dbUrl, ssl: useSSL, max: 3 })

// ── IDs ──────────────────────────────────────────────────────────────
const ORG_SLUG = 'hughes-for-rep'
const CAMPAIGN_SLUG = 'hughes-2026'

// ── Campaign Settings ────────────────────────────────────────────────
const SETTINGS = {
  surveyQuestions: [
    {
      id: 'support_level',
      label: 'Can Anne count on your vote in 2026?',
      type: 'select',
      options: ['Strong Yes', 'Lean Yes', 'Undecided', 'Lean No', 'Strong No'],
    },
    {
      id: 'top_issue',
      label: 'Which issue matters most to you?',
      type: 'select',
      options: [
        'Reproductive Freedom',
        'Climate Action',
        'Worker Protections',
        'Gun Safety',
        'Elder Care',
        'LGBTQ+ Rights',
        'Healthcare',
        'Education',
        'Housing',
        'Other',
      ],
    },
    {
      id: 'small_dollar_ask',
      label: 'Will you pitch in $5 to help Anne qualify for clean elections funding?',
      type: 'select',
      options: ['Yes', 'Maybe later', 'No'],
    },
    {
      id: 'host_event',
      label: 'Would you host a coffee or house party for Anne?',
      type: 'select',
      options: ['Yes', 'Maybe', 'No'],
    },
    {
      id: 'volunteer_interest',
      label: 'Would you knock doors or make calls for Anne?',
      type: 'select',
      options: ['Yes', 'Maybe', 'No'],
    },
    {
      id: 'needs_ride',
      label: 'Needs ride to polls?',
      type: 'select',
      options: ['Yes', 'No', 'Maybe'],
    },
  ],
  aiContext: {
    campaignType: 'candidate',
    goalPriorities: ['fundraising', 'volunteer-recruitment', 'persuasion'],
    candidateInfo: {
      name: 'Anne Hughes',
      party: 'Democratic',
      office: 'Connecticut State Representative, 135th District',
    },
    electionInfo: {
      date: '2026-11-03',
      state: 'CT',
      district: 'HD-135 (Easton, Redding, Weston)',
    },
    goals: 'Power a citizen-led campaign by collecting $5 qualifying contributions from neighbors in Easton, Redding, and Weston. Every $5 from a local resident brings Anne closer to unlocking Connecticut\'s Citizens\' Election Program — proving this campaign is built by the community, not big donors.',
    keyIssues: [
      'Reproductive freedom — defending bodily autonomy and healthcare access',
      'Climate action — 100% environmental scorecard, offshore wind champion',
      'Worker protections — paid family leave, warehouse worker safety, fair wages',
      'Gun safety — safe storage laws, domestic violence protections',
      'Elder care — licensed social worker fighting elder abuse, nursing home quality',
      'LGBTQ+ rights — equality, dignity, and protection for all',
    ],
    talkingPoints: [
      'Anne is serving her fourth term and has delivered real results — Take Back Our Grid Act, warehouse worker protections, PFAS bans, paid family leave.',
      'She earned a perfect 100% environmental score from CT League of Conservation Voters.',
      'As a Licensed Master Social Worker, Anne brings real-world experience protecting vulnerable populations.',
      'Just $5 from a neighbor in Easton, Redding, or Weston counts as a qualifying contribution — that\'s citizen-led action in its purest form.',
      'Connecticut\'s Citizens\' Election Program turns grassroots $5 donations into real public funding — your five dollars proves this campaign belongs to the community.',
    ],
    messagingGuidance: 'Lead with the issues Anne is fighting for, then connect to the $5 ask. Example: "Anne walked alongside us to protect our grid and fight for paid leave — now she needs your $5 to qualify for clean elections funding." Frame every ask as citizen-led action: neighbors funding their own representative. Never ask for more than $320 (CT CEP limit). The $5 contribution is the priority — volume of donors matters more than dollar amount. Always collect the donor\'s town (Easton, Redding, or Weston) for CEP residency tracking.',
    partyStrategies: {
      DEM: 'Thank them for walking alongside Anne. Ask what issue matters most to their family, then connect it to the $5 citizen-led ask: "Your $5 proves this campaign belongs to Easton, Redding, and Weston — not big donors." Mention CEP and how every $5 from a neighbor unlocks public funding.',
      REP: 'Lead with what Anne has done for everyone — holding utilities accountable, protecting elders from abuse, banning coerced debt. She fights for the community, not a party. If they\'re receptive, a gentle $5 ask: "Even folks who don\'t always agree with Anne respect that she shows up."',
      UNF: 'Lead with results in their town. Anne delivers for all residents — Take Back Our Grid, safer nursing homes, PFAS bans. Ask what matters to them. If receptive: "A $5 contribution is the most powerful thing a neighbor can do — it qualifies Anne for clean elections funding."',
      OTHER: 'Focus on Anne\'s progressive record on environment, workers\' rights, and social justice. Frame the $5 as an act of citizen-led power: "This is how we build a Connecticut that works for everyone."',
    },
    fundraisingConfig: {
      requireResidency: true,
      contributionLimits: 'CT Citizens\' Election Program: qualifying contributions $5–$320 per individual. Donors must be CT residents (age 12+). State contractors, principals of state contractors, and communicator lobbyists are PROHIBITED from contributing. In-district donors from Easton, Redding, and Weston are the top priority for CEP qualification. Out-of-district CT residents also count toward the monetary threshold — do not turn them away.',
      fundraisingGuidance: 'The #1 goal is volume of $5 qualifying contributions from residents of Easton, Redding, and Weston. Every $5 from a neighbor counts toward unlocking CT Citizens\' Election Program public financing — this is citizen-led action at its core. The number of individual donors matters far more than total dollars raised. Frame every ask around community ownership: "Your $5 proves this campaign belongs to us." Track donor town for CEP residency verification. Never ask for more than $320.',
      fundraiserTypes: [
        {
          id: randomUUID(),
          name: 'CEP $5 Qualifying Ask',
          guidance: 'The core ask: $5 from a neighbor in Easton, Redding, or Weston. Frame it as citizen-led action — "Your $5 is the most powerful thing you can do for this campaign." Connect to a specific issue Anne has fought for. Always collect donor name, address, and town for CEP residency verification. Volume is everything — 200 five-dollar donors beats one max-out.',
        },
        {
          id: randomUUID(),
          name: 'House Party / Coffee',
          guidance: 'Citizen-led gathering in a supporter\'s home in Easton, Redding, or Weston. Goal: 15–25 neighbors each giving $5 (or more if they choose). The host invites their own network — this is community organizing at the kitchen table. Provide the host with talking points about Anne\'s record and how every $5 CEP contribution builds people-powered representation. Casual, welcoming atmosphere.',
        },
        {
          id: randomUUID(),
          name: 'Digital Grassroots',
          guidance: 'Social media and email-driven small dollar campaign. Share Anne\'s legislative wins with a direct donation link. Target $10–$25 asks. Leverage issue moments (e.g., after a committee vote on climate or worker protections) for timely asks.',
        },
        {
          id: randomUUID(),
          name: 'Community Event Fundraiser',
          guidance: 'Public-facing campaign event with a suggested donation. Town halls, meet-and-greets, or issue-focused forums. Low-dollar entry ($10–$25). Focus on visibility and community building alongside fundraising.',
        },
      ],
    },
    targetUniverse: {
      VH2024G: 'voted',
      VH2022G: 'voted',
    },
  },
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Anne Hughes for State Representative — Campaign Setup ===\n')

  // 1. Create or find organization
  let orgId
  const { rows: existingOrg } = await pool.query(
    'SELECT id FROM organizations WHERE slug = $1',
    [ORG_SLUG]
  )

  if (existingOrg.length > 0) {
    orgId = existingOrg[0].id
    console.log(`[org] Found existing organization: ${orgId}`)
  } else {
    orgId = randomUUID()
    await pool.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
      [orgId, 'Anne Hughes for State Representative', ORG_SLUG]
    )
    console.log(`[org] Created organization: ${orgId}`)
  }

  // 2. Create or update campaign
  let campaignId
  const { rows: existingCampaign } = await pool.query(
    'SELECT id FROM campaigns WHERE slug = $1 AND org_id = $2',
    [CAMPAIGN_SLUG, orgId]
  )

  if (existingCampaign.length > 0) {
    campaignId = existingCampaign[0].id
    console.log(`[campaign] Found existing campaign: ${campaignId}`)

    // Update settings
    await pool.query(
      'UPDATE campaigns SET settings = $1, candidate_name = $2, state = $3, election_date = $4 WHERE id = $5',
      [JSON.stringify(SETTINGS), 'Anne Hughes', 'CT', '2026-11-03', campaignId]
    )
    console.log(`[campaign] Updated settings for campaign: ${campaignId}`)
  } else {
    campaignId = randomUUID()
    await pool.query(
      `INSERT INTO campaigns (id, org_id, name, slug, candidate_name, state, election_date, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [campaignId, orgId, 'Anne Hughes for State Representative', CAMPAIGN_SLUG, 'Anne Hughes', 'CT', '2026-11-03', JSON.stringify(SETTINGS)]
    )
    console.log(`[campaign] Created campaign: ${campaignId}`)
  }

  console.log(`
==============================================
  Setup Complete
==============================================
  Organization: Anne Hughes for State Representative (${orgId})
  Campaign:     Anne Hughes for State Representative (${campaignId})
  Slug:         ${CAMPAIGN_SLUG}
  State:        CT
  District:     HD-135 (Easton, Redding, Weston)
  Election:     2026-11-03
  Priority:     Small dollar fundraising (CEP)
==============================================

Next steps:
  1. Convert VAN export:
     node scripts/convert-van-tsv.mjs \\
       --file=/tmp/voter-import/voters-utf8.txt \\
       --output=data/ct-hd135-voters.json

  2. Import voter data:
     node scripts/import-voter-dataset.mjs \\
       --file=data/ct-hd135-voters.json \\
       --name="CT HD-135 (Easton, Redding, Weston)" \\
       --state=CT \\
       --geo-type=district \\
       --geo-name="HD-135" \\
       --assign=${campaignId}
`)

  await pool.end()
}

main().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})
