#!/usr/bin/env node
/**
 * Seed a "Selena Meyer for Governor" fundraising-focused campaign.
 *
 * Creates:
 *   - Organization: "Meyer for Governor" (org-meyer)
 *   - Campaign: "Selena Meyer 2026" (selena-meyer-2026) with state=NC
 *   - AI context pre-configured for fundraising
 *   - Admin membership for existing platform admin
 *   - Product subscriptions (events + relational)
 *
 * Optionally links a voter dataset if --dataset=<id> is provided.
 *
 * Usage:
 *   node scripts/seed-selena-meyer-campaign.js
 *   node scripts/seed-selena-meyer-campaign.js --dataset=vds-abc123
 *
 * Requires DATABASE_URL environment variable.
 */

const { Pool } = require('pg')
const crypto = require('crypto')

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  console.error('Example: DATABASE_URL=postgresql://user:pass@localhost:5432/threshold node scripts/seed-selena-meyer-campaign.js')
  process.exit(1)
}

const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({ connectionString: dbUrl, ssl: useSSL })

const ORG_ID = 'org-meyer'
const ORG_NAME = 'Meyer for Governor'
const ORG_SLUG = 'meyer-for-governor'

const CAMPAIGN_ID = 'selena-meyer-2026'
const CAMPAIGN_NAME = 'Selena Meyer 2026'
const CAMPAIGN_SLUG = 'selena-meyer-2026'
const CANDIDATE_NAME = 'Selena Meyer'
const CAMPAIGN_STATE = 'NC'
const ELECTION_DATE = '2026-11-03'

// Parse --dataset=<id> arg
const datasetArg = process.argv.find(a => a.startsWith('--dataset='))
const datasetId = datasetArg?.split('=')[1]

const CAMPAIGN_SETTINGS = {
  surveyQuestions: [
    {
      id: 'donation_interest',
      label: 'Interested in donating?',
      type: 'select',
      options: ['Yes - ready now', 'Yes - need more info', 'Maybe later', 'Not at this time'],
    },
    {
      id: 'contribution_range',
      label: 'Contribution range',
      type: 'select',
      options: ['Under $50', '$50-$250', '$250-$1,000', '$1,000-$5,000', '$5,000+'],
    },
    {
      id: 'host_event',
      label: 'Would host a fundraiser?',
      type: 'select',
      options: ['Yes', 'Maybe', 'No'],
    },
    {
      id: 'top_issue',
      label: 'Top issue',
      type: 'select',
      options: ['Education', 'Healthcare', 'Economy/Jobs', 'Environment', 'Infrastructure', 'Housing', 'Public Safety', 'Other'],
    },
  ],
  aiContext: {
    goals: 'Elect Selena Meyer as Governor of North Carolina by building a strong grassroots fundraising operation. Focus on expanding the donor base, converting small-dollar donors into recurring contributors, identifying potential major donors and event hosts, and hitting quarterly fundraising targets to demonstrate campaign viability.',
    keyIssues: [
      'Public education funding and teacher pay',
      'Affordable healthcare access',
      'Clean energy jobs and economic development',
      'Infrastructure and rural broadband',
      'Affordable housing',
    ],
    talkingPoints: [
      'Selena Meyer has a proven track record of bringing people together across party lines to get things done for North Carolina families.',
      'Our grassroots fundraising shows the strength of this campaign — every dollar from a supporter in Raleigh, Asheville, or Fayetteville sends a message that North Carolinians are ready for new leadership.',
      'Your contribution directly funds our field program reaching voters in all 100 counties.',
      'We are building the largest grassroots donor base in NC gubernatorial history.',
      'Recurring monthly donations are the backbone of our campaign — even $10/month makes a real difference.',
    ],
    messagingGuidance: 'Lead with why their support matters — connect donations to tangible outcomes (field organizers hired, doors knocked, communities reached). Never pressure; always frame giving as an investment in NC\'s future. For major donor asks, emphasize access to the candidate and shaping policy priorities. For grassroots donors, emphasize collective power and belonging to the movement.',
    campaignType: 'candidate',
    goalPriorities: ['fundraising'],
    candidateInfo: {
      name: 'Selena Meyer',
      party: 'Democratic',
      office: 'Governor of North Carolina',
      district: 'Statewide',
    },
    electionInfo: {
      electionDate: '2026-11-03',
      electionType: 'general',
      state: 'NC',
    },
    partyStrategies: {
      DEM: 'Thank them for their past support and ask them to invest in electing a Democratic governor who will fight for progressive priorities. Emphasize party unity and the importance of this race for the state.',
      REP: 'Focus on Selena\'s bipartisan track record and pragmatic approach to governing. Emphasize shared values like fiscal responsibility, economic growth, and strong communities. Avoid partisan framing.',
      IND: 'Highlight Selena\'s independence from party orthodoxy and her focus on results over ideology. Emphasize that supporting her campaign is an investment in competent, common-sense leadership.',
    },
    fundraisingConfig: {
      requireResidency: false,
      contributionLimits: 'NC gubernatorial contribution limits: $6,400 per individual per election ($6,400 primary + $6,400 general = $12,800 total cycle). PAC limit: $6,400 per election. No corporate contributions allowed in NC.',
      fundraisingGuidance: 'Always thank the donor for any previous support before making a new ask. Suggest specific amounts anchored to the conversation — for first-time donors, start with an accessible ask ($25-$50) and mention recurring options. For existing donors, suggest upgrading or increasing frequency. For major donor prospects ($1,000+), offer to connect them with the finance team for a personal conversation with the candidate. Always mention that contributions are not tax-deductible.',
      fundraiserTypes: [
        {
          id: crypto.randomUUID(),
          name: 'Grassroots',
          guidance: 'Focus on small-dollar donations ($10-$100). Emphasize collective power: "If everyone in your contact list gave just $25, that\'s another field organizer on the ground." Promote recurring monthly giving. Share the donate link and make it easy.',
        },
        {
          id: crypto.randomUUID(),
          name: 'Mid-Level',
          guidance: 'Target $250-$2,500 range. Offer invitations to intimate events with the candidate, policy briefings, or volunteer leadership roles. Frame their contribution as joining an inner circle of committed supporters.',
        },
        {
          id: crypto.randomUUID(),
          name: 'Max Out',
          guidance: 'For donors considering $5,000+ (toward the $6,400 per-election max). Offer direct access to the candidate, invite to exclusive strategy sessions, and position them as founding investors in the campaign. Coordinate with the finance director for personalized outreach.',
        },
        {
          id: crypto.randomUUID(),
          name: 'Host Committee',
          guidance: 'For supporters willing to host fundraising events at their home or venue. Help them set a fundraising goal, create a host committee, and leverage their personal network. Provide event planning support and ensure the candidate or surrogate attends.',
        },
      ],
    },
  },
}

async function main() {
  const client = await pool.connect()
  try {
    console.log('=== Seeding Selena Meyer for Governor Campaign ===\n')

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

    // 2. Create campaign with fundraising AI context
    const { rows: existingCampaign } = await client.query(
      'SELECT id FROM campaigns WHERE id = $1', [CAMPAIGN_ID]
    )
    if (existingCampaign.length === 0) {
      await client.query(
        `INSERT INTO campaigns (id, org_id, name, slug, candidate_name, state, election_date, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [CAMPAIGN_ID, ORG_ID, CAMPAIGN_NAME, CAMPAIGN_SLUG, CANDIDATE_NAME, CAMPAIGN_STATE, ELECTION_DATE, JSON.stringify(CAMPAIGN_SETTINGS)]
      )
      console.log(`Created campaign: ${CAMPAIGN_NAME} (${CAMPAIGN_ID}, state=${CAMPAIGN_STATE})`)
      console.log(`  Candidate: ${CANDIDATE_NAME}`)
      console.log(`  Office: Governor of North Carolina`)
      console.log(`  Focus: Fundraising`)
    } else {
      // Update settings if campaign already exists
      await client.query(
        `UPDATE campaigns SET settings = $2, candidate_name = $3 WHERE id = $1`,
        [CAMPAIGN_ID, JSON.stringify(CAMPAIGN_SETTINGS), CANDIDATE_NAME]
      )
      console.log(`Campaign already exists: ${CAMPAIGN_ID} — updated settings`)
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

    // 4. Seed product subscriptions for org
    for (const product of ['events', 'relational']) {
      const { rows: existingSub } = await client.query(
        'SELECT id FROM product_subscriptions WHERE organization_id = $1 AND product = $2',
        [ORG_ID, product]
      )
      if (existingSub.length === 0) {
        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setMonth(periodEnd.getMonth() + 12)
        await client.query(
          `INSERT INTO product_subscriptions (id, organization_id, product, plan, status, current_period_start, current_period_end, limits)
           VALUES ($1, $2, $3, 'scale', 'active', $4, $5, $6)`,
          [crypto.randomUUID(), ORG_ID, product, now.toISOString(), periodEnd.toISOString(), JSON.stringify({
            maxRsvpsPerMonth: -1,
            maxTeamMembers: -1,
            analytics: true,
            customBranding: true,
            apiAccess: true,
            whiteLabel: true,
          })]
        )
        console.log(`Created ${product} subscription for ${ORG_NAME}`)
      } else {
        console.log(`${product} subscription already exists for ${ORG_NAME}`)
      }
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

    console.log('\nDone! Selena Meyer campaign is ready.')
    console.log(`  Org:       ${ORG_NAME} (${ORG_ID})`)
    console.log(`  Campaign:  ${CAMPAIGN_NAME} (${CAMPAIGN_ID})`)
    console.log(`  Candidate: ${CANDIDATE_NAME}`)
    console.log(`  Office:    Governor of North Carolina`)
    console.log(`  Focus:     Fundraising`)
    if (!datasetId) {
      console.log('\nNext: Import NC statewide voter data, then link it:')
      console.log(`  node scripts/seed-selena-meyer-campaign.js --dataset=<dataset-id>`)
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
