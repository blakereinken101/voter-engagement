import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const [orgs, users, campaigns, subs, events, rsvps, newUsers, newOrgs] = await Promise.all([
      db.query('SELECT COUNT(*)::int as count FROM organizations'),
      db.query('SELECT COUNT(*)::int as count FROM users'),
      db.query('SELECT COUNT(*)::int as count FROM campaigns WHERE is_active = true'),
      db.query("SELECT COUNT(*)::int as count FROM product_subscriptions WHERE status IN ('active', 'trialing')"),
      db.query('SELECT COUNT(*)::int as count FROM events'),
      db.query('SELECT COUNT(*)::int as count FROM event_rsvps'),
      db.query("SELECT COUNT(*)::int as count FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"),
      db.query("SELECT COUNT(*)::int as count FROM organizations WHERE created_at >= NOW() - INTERVAL '30 days'"),
    ])

    return NextResponse.json({
      totalOrganizations: orgs.rows[0].count,
      totalUsers: users.rows[0].count,
      totalActiveCampaigns: campaigns.rows[0].count,
      activeSubscriptions: subs.rows[0].count,
      totalEvents: events.rows[0].count,
      totalRsvps: rsvps.rows[0].count,
      newUsersLast30Days: newUsers.rows[0].count,
      newOrgsLast30Days: newOrgs.rows[0].count,
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
