/**
 * Standalone seed script — extracted from the former seedDefaults() and
 * seedEvents() functions in src/lib/db.ts.
 *
 * Run with:  DATABASE_URL=postgres://... node scripts/seed.mjs
 * Or via:    npm run seed
 *
 * All operations are idempotent (INSERT ... ON CONFLICT DO NOTHING, existence
 * checks) so it is safe to run repeatedly.
 */

import pg from 'pg'
import bcryptjs from 'bcryptjs'
import crypto from 'node:crypto'

const { Pool } = pg
const { hashSync } = bcryptjs

// ── Connection (same SSL logic as src/lib/db.ts) ─────────────────────
const dbUrl = process.env.DATABASE_URL || ''
const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({
  connectionString: dbUrl || undefined,
  ssl: useSSL,
})

// Inline PLAN_LIMITS.scale to avoid importing TypeScript types
const SCALE_LIMITS = {
  maxRsvpsPerMonth: -1,
  maxTeamMembers: -1,
  analytics: true,
  customBranding: true,
  apiAccess: true,
  whiteLabel: true,
}

// ── seedDefaults ─────────────────────────────────────────────────────
async function seedDefaults(client) {
  const campaignId = process.env.CAMPAIGN_ID || 'demo-2026'
  const orgId = 'org-default'
  const orgName = process.env.NEXT_PUBLIC_ORGANIZATION_NAME || 'Threshold'
  const campaignName = process.env.NEXT_PUBLIC_CAMPAIGN_NAME || 'Threshold Demo'
  const candidateName = process.env.NEXT_PUBLIC_CANDIDATE_NAME || 'Demo Candidate'
  const state = process.env.NEXT_PUBLIC_CAMPAIGN_STATE || 'NC'
  const electionDate = process.env.ELECTION_DATE || '2026-11-03'

  // Ensure default organization exists
  const { rows: existingOrg } = await client.query('SELECT id FROM organizations WHERE id = $1', [orgId])
  if (existingOrg.length === 0) {
    await client.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`,
      [orgId, orgName, 'default']
    )
    console.log(`[seed] Seeded default organization: ${orgName}`)
  }

  // Ensure default campaign exists
  const { rows: existingCampaign } = await client.query('SELECT id FROM campaigns WHERE id = $1', [campaignId])
  if (existingCampaign.length === 0) {
    await client.query(
      `INSERT INTO campaigns (id, org_id, name, slug, candidate_name, state, election_date, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [campaignId, orgId, campaignName, campaignId, candidateName, state, electionDate, JSON.stringify({
        surveyQuestions: [
          { id: 'top_issue', label: 'Top issue', type: 'select', options: ['Economy', 'Healthcare', 'Education', 'Environment', 'Immigration', 'Housing', 'Crime/Safety', 'Other'] },
          { id: 'vote_plan', label: 'Plan to vote?', type: 'select', options: ['Yes - Election Day', 'Yes - Early voting', 'Yes - By mail', 'Maybe', 'No'] },
          { id: 'needs_ride', label: 'Needs ride to polls?', type: 'select', options: ['Yes', 'No', 'Maybe'] },
        ],
      })]
    )
    console.log(`[seed] Seeded default campaign: ${campaignName}`)
  }

  // Ensure admin user exists
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@thresholdvote.com'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || (
    process.env.NODE_ENV === 'production' ? '' : 'changeme123'
  )
  const { rows: existingAdmin } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])

  let adminId = null
  if (existingAdmin.length === 0 && adminPassword) {
    adminId = crypto.randomUUID()
    const passwordHash = hashSync(adminPassword, 10)
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, campaign_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, 'admin', $5, true)`,
      [adminId, adminEmail, passwordHash, 'Admin', campaignId]
    )
    console.log(`[seed] Seeded admin user: ${adminEmail}`)
  } else if (existingAdmin.length === 0) {
    console.warn('[seed] No ADMIN_SEED_PASSWORD set — skipping admin user creation')
  } else {
    adminId = existingAdmin[0].id
    await client.query('UPDATE users SET is_platform_admin = true WHERE id = $1', [adminId])
  }

  if (adminId) {
    // Ensure admin has membership in default campaign
    const { rows: existingMembership } = await client.query(
      'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2',
      [adminId, campaignId]
    )
    if (existingMembership.length === 0) {
      await client.query(
        `INSERT INTO memberships (id, user_id, campaign_id, role) VALUES ($1, $2, $3, 'campaign_admin')`,
        [crypto.randomUUID(), adminId, campaignId]
      )
      console.log(`[seed] Seeded admin membership in campaign: ${campaignId}`)
    }

    // Ensure admin has all product access grants
    for (const product of ['events', 'relational', 'texting']) {
      await client.query(
        `INSERT INTO user_products (id, user_id, product)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product) DO NOTHING`,
        [crypto.randomUUID(), adminId, product]
      )
    }
  }

  // ── Backfill relational product for all users who have memberships ──
  const { rowCount: relationalBackfilled } = await client.query(`
    INSERT INTO user_products (id, user_id, product)
    SELECT gen_random_uuid(), m.user_id, 'relational'
    FROM memberships m
    WHERE m.is_active = true
    ON CONFLICT (user_id, product) DO NOTHING
  `)
  if (relationalBackfilled && relationalBackfilled > 0) {
    console.log(`[seed] Backfilled relational product for ${relationalBackfilled} users with memberships`)
  }

  // ── Migrate existing users without memberships (legacy relational users only) ──
  const { rows: usersWithoutMembership } = await client.query(`
    SELECT u.id, u.campaign_id, u.role FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)
    AND u.campaign_id IS NOT NULL
    ${adminId ? 'AND u.id != $1' : ''}
  `, adminId ? [adminId] : [])

  for (const user of usersWithoutMembership) {
    const { rows: camp } = await client.query('SELECT id FROM campaigns WHERE id = $1', [user.campaign_id])
    const targetCampaign = camp.length > 0 ? user.campaign_id : campaignId
    const memberRole = user.role === 'admin' ? 'campaign_admin' : 'volunteer'
    await client.query(
      `INSERT INTO memberships (id, user_id, campaign_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, campaign_id) DO NOTHING`,
      [crypto.randomUUID(), user.id, targetCampaign, memberRole]
    )
    // Also grant relational product to these newly-migrated users
    await client.query(
      `INSERT INTO user_products (id, user_id, product)
       VALUES ($1, $2, 'relational')
       ON CONFLICT (user_id, product) DO NOTHING`,
      [crypto.randomUUID(), user.id]
    )
  }

  if (usersWithoutMembership.length > 0) {
    console.log(`[seed] Migrated ${usersWithoutMembership.length} users to memberships`)
  }

  // ── Backfill campaign_id on contacts + activity_log ──────────────
  const { rowCount: contactsBackfilled } = await client.query(
    'UPDATE contacts SET campaign_id = $1 WHERE campaign_id IS NULL', [campaignId]
  )
  if (contactsBackfilled && contactsBackfilled > 0) {
    console.log(`[seed] Backfilled campaign_id on ${contactsBackfilled} contacts`)
  }

  const { rowCount: activityBackfilled } = await client.query(
    'UPDATE activity_log SET campaign_id = $1 WHERE campaign_id IS NULL', [campaignId]
  )
  if (activityBackfilled && activityBackfilled > 0) {
    console.log(`[seed] Backfilled campaign_id on ${activityBackfilled} activity_log rows`)
  }

  // ── Seed events subscription for default org ─────────────────
  const { rows: existingSub } = await client.query(
    "SELECT id FROM product_subscriptions WHERE organization_id = $1 AND product = 'events'",
    [orgId]
  )
  if (existingSub.length === 0) {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    await client.query(
      `INSERT INTO product_subscriptions (id, organization_id, product, plan, status, current_period_start, current_period_end, limits)
       VALUES ($1, $2, 'events', 'scale', 'active', $3, $4, $5)`,
      [crypto.randomUUID(), orgId, now.toISOString(), periodEnd.toISOString(), JSON.stringify(SCALE_LIMITS)]
    )
    console.log(`[seed] Seeded default events subscription (scale) for org: ${orgId}`)
  }

  // ── Seed placeholder events ──────────────────────────────────
  if (adminId) {
    await seedEvents(client, orgId, adminId)
  }
}

// ── seedEvents ───────────────────────────────────────────────────────
async function seedEvents(client, orgId, adminId) {
  const { rows: existing } = await client.query(
    'SELECT COUNT(*) FROM events WHERE organization_id = $1',
    [orgId]
  )
  if (parseInt(existing[0].count, 10) > 0) return

  function seedSlug(title) {
    const base = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    const suffix = crypto.randomUUID().slice(0, 6)
    return `${base}-${suffix}`
  }

  function futureDate(daysFromNow, hour, minute = 0) {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }

  function endDate(daysFromNow, hour, minute = 0) {
    return futureDate(daysFromNow, hour, minute)
  }

  const events = [
    {
      title: 'New Volunteer Orientation',
      description: 'New to organizing? Start here! This orientation covers everything you need to know to get involved: how to canvass, phone bank, register voters, and make a real impact in your community. Snacks and materials provided.',
      event_type: 'volunteer_training',
      start_time: futureDate(4, 17, 30),
      end_time: endDate(4, 19, 30),
      location_name: 'Downtown Organizing HQ',
      location_city: 'Charlotte',
      location_state: 'NC',
      location_zip: '28202',
      is_virtual: false,
      emoji: '\u{1F4CB}',
      theme_color: '#6C3CE1',
      max_attendees: 40,
    },
    {
      title: 'Community Cleanup & Voter Contact',
      description: "Make a visible difference in your neighborhood! We'll spend the morning cleaning up the park and the afternoon talking to neighbors about upcoming elections. Community service meets civic engagement.",
      event_type: 'community',
      start_time: futureDate(12, 9, 0),
      end_time: endDate(12, 15, 0),
      location_name: 'Riverside Park',
      location_city: 'Milwaukee',
      location_state: 'WI',
      location_zip: '53212',
      is_virtual: false,
      emoji: '\u{1F31F}',
      theme_color: '#14B8A6',
      max_attendees: 50,
    },
    {
      title: 'Voter Registration Drive',
      description: "Every vote counts \u2014 and it starts with registration. Join us to register new voters, check registrations, and make sure every eligible citizen can make their voice heard. Volunteers will be stationed at community centers, libraries, and college campuses.",
      event_type: 'voter_registration',
      start_time: futureDate(9, 9, 0),
      end_time: endDate(9, 17, 0),
      location_name: 'Multiple Locations',
      location_city: 'Phoenix',
      location_state: 'AZ',
      location_zip: '85001',
      is_virtual: false,
      emoji: '\u{1F4DD}',
      theme_color: '#14B8A6',
      max_attendees: 100,
    },
    {
      title: 'Ballot Party: Know Your Candidates',
      description: "Don't show up to the polls unprepared! Join us for an interactive ballot walkthrough. We'll cover every race on the ballot, research candidates together, and make sure you're ready to vote informed all the way down-ballot.",
      event_type: 'ballot_party',
      start_time: futureDate(16, 18, 0),
      end_time: endDate(16, 20, 30),
      location_name: 'Community Library',
      location_city: 'Atlanta',
      location_state: 'GA',
      location_zip: '30303',
      is_virtual: false,
      emoji: '\u{1F5F3}\uFE0F',
      theme_color: '#F59E0B',
      max_attendees: 60,
    },
  ]

  for (const event of events) {
    const id = crypto.randomUUID()
    const slug = seedSlug(event.title)
    await client.query(
      `INSERT INTO events (
        id, organization_id, created_by, title, description, event_type,
        start_time, end_time, timezone,
        location_name, location_address, location_city, location_state, location_zip,
        is_virtual, virtual_url,
        cover_image_url, emoji, theme_color,
        visibility, max_attendees, rsvp_enabled, status, slug
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, 'America/New_York',
        $9, $10, $11, $12, $13,
        $14, $15,
        NULL, $16, $17,
        'public', $18, true, 'published', $19
      )`,
      [
        id, orgId, adminId, event.title, event.description, event.event_type,
        event.start_time, event.end_time || null,
        event.location_name || null, event.location_address || null,
        event.location_city || null, event.location_state || null, event.location_zip || null,
        event.is_virtual, event.virtual_url || null,
        event.emoji, event.theme_color,
        event.max_attendees || null, slug
      ]
    )
  }

  console.log(`[seed] Seeded ${events.length} placeholder events`)
}

// ── Main ─────────────────────────────────────────────────────────────
const client = await pool.connect()
try {
  await seedDefaults(client)
  console.log('[seed] Seed complete')
} catch (err) {
  console.error('[seed] Seed failed:', err)
  process.exit(1)
} finally {
  client.release()
  await pool.end()
}
