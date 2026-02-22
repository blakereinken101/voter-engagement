import { NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'

export async function GET() {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const campaignId = ctx.campaignId

    const { rows: activityRows } = await db.query('SELECT COUNT(*) as c FROM activity_log WHERE campaign_id = $1', [campaignId])
    const { rows: actionRows } = await db.query(
      'SELECT COUNT(*) as c FROM action_items ai JOIN contacts c ON c.id = ai.contact_id WHERE c.campaign_id = $1', [campaignId]
    )
    const { rows: matchRows } = await db.query(
      'SELECT COUNT(*) as c FROM match_results mr JOIN contacts c ON c.id = mr.contact_id WHERE c.campaign_id = $1', [campaignId]
    )
    const { rows: contactRows } = await db.query('SELECT COUNT(*) as c FROM contacts WHERE campaign_id = $1', [campaignId])
    const { rows: userCountRows } = await db.query(
      "SELECT COUNT(*) as c FROM memberships WHERE campaign_id = $1 AND role = 'volunteer'", [campaignId]
    )

    return NextResponse.json({
      activity_log: parseInt(activityRows[0].c),
      action_items: parseInt(actionRows[0].c),
      match_results: parseInt(matchRows[0].c),
      contacts: parseInt(contactRows[0].c),
      users: parseInt(userCountRows[0].c),
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const campaignId = ctx.campaignId

    const body = await request.json()
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    // Delete only this campaign's data (action_items + match_results cascade from contacts)
    await db.query('DELETE FROM activity_log WHERE campaign_id = $1', [campaignId])
    await db.query('DELETE FROM contacts WHERE campaign_id = $1', [campaignId])
    // Remove volunteer memberships but keep admin memberships
    await db.query("DELETE FROM memberships WHERE campaign_id = $1 AND role = 'volunteer'", [campaignId])

    // Log the purge action
    await logActivity(ctx.userId, 'data_purge', { deletedBy: ctx.userId }, campaignId)

    return NextResponse.json({
      success: true,
      message: 'Campaign data purged. Admin accounts preserved.',
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
