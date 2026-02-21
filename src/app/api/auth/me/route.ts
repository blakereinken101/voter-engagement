import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET() {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()
    const { rows } = await db.query(
      'SELECT id, email, name, role, campaign_id, created_at FROM users WHERE id = $1',
      [session.userId]
    )
    const user = rows[0] as { id: string; email: string; name: string; role: string; campaign_id: string; created_at: string } | undefined

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        campaignId: user.campaign_id,
        createdAt: user.created_at,
      }
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
