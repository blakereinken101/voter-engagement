import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const [recentSignIns, onlineNow, onlineToday] = await Promise.all([
      // Recent sign-ins with campaign info
      db.query(`
        SELECT u.id, u.name, u.email, u.last_signed_in_at, u.last_active_at,
               m.campaign_id, c.name as campaign_name, m.role
        FROM users u
        LEFT JOIN LATERAL (
          SELECT m2.campaign_id, m2.role
          FROM memberships m2
          WHERE m2.user_id = u.id AND m2.is_active = true
          ORDER BY m2.joined_at DESC LIMIT 1
        ) m ON true
        LEFT JOIN campaigns c ON c.id = m.campaign_id
        WHERE u.last_signed_in_at IS NOT NULL
        ORDER BY u.last_signed_in_at DESC
        LIMIT 50
      `),

      // Online now = active within last 15 minutes
      db.query(`
        SELECT COUNT(*)::int as count FROM users
        WHERE last_active_at >= NOW() - INTERVAL '15 minutes'
      `),

      // Active today
      db.query(`
        SELECT COUNT(*)::int as count FROM users
        WHERE last_active_at >= NOW() - INTERVAL '24 hours'
      `),
    ])

    return NextResponse.json({
      onlineNow: onlineNow.rows[0].count,
      activeToday: onlineToday.rows[0].count,
      recentSignIns: recentSignIns.rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        lastSignedInAt: r.last_signed_in_at,
        lastActiveAt: r.last_active_at,
        campaignName: r.campaign_name,
        role: r.role,
        isOnline: r.last_active_at && new Date(r.last_active_at) > new Date(Date.now() - 15 * 60 * 1000),
      })),
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
