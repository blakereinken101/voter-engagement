import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'

export async function GET(_request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { userId } = params

    // Verify user is a member of this campaign
    const { rows: memberRows } = await db.query(
      'SELECT u.id, u.email, u.name, u.created_at FROM users u JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $1 WHERE u.id = $2',
      [ctx.campaignId, userId]
    )
    if (!memberRows[0]) return NextResponse.json({ error: 'User not found in this campaign' }, { status: 404 })

    const { rows: contacts } = await db.query(`
      SELECT c.*,
             mr.status as match_status, mr.best_match_data, mr.vote_score, mr.segment, mr.user_confirmed,
             ai.contacted, ai.contacted_date, ai.outreach_method, ai.contact_outcome, ai.notes,
             ai.is_volunteer_prospect, ai.volunteer_interest
      FROM contacts c
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE c.user_id = $1 AND c.campaign_id = $2
      ORDER BY c.created_at DESC
    `, [userId, ctx.campaignId])

    return NextResponse.json({ user: memberRows[0], contacts })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
