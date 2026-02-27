import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignAdmin, mapContactRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

/** Assign a batch of contacts to a texter. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)

    const body = await request.json()
    const { userId, batchSize = 200 } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const pool = getPool()

    // Verify user is a campaign member
    const { rows: memberRows } = await pool.query(
      `SELECT 1 FROM text_campaign_members WHERE text_campaign_id = $1 AND user_id = $2 AND is_active = true`,
      [params.id, userId]
    )
    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'User is not a member of this campaign' }, { status: 400 })
    }

    // Assign pending, unassigned contacts
    const { rowCount } = await pool.query(
      `UPDATE text_campaign_contacts
       SET assigned_to = $1
       WHERE id IN (
         SELECT id FROM text_campaign_contacts
         WHERE text_campaign_id = $2 AND status = 'pending' AND assigned_to IS NULL
         ORDER BY created_at ASC
         LIMIT $3
       )`,
      [userId, params.id, batchSize]
    )

    return NextResponse.json({ assigned: rowCount || 0 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** Release (unassign) all contacts from a texter. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || ctx.userId

    // Only admins can release other users' assignments
    if (userId !== ctx.userId) {
      await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)
    }

    const pool = getPool()
    const { rowCount } = await pool.query(
      `UPDATE text_campaign_contacts
       SET assigned_to = NULL
       WHERE text_campaign_id = $1 AND assigned_to = $2 AND status IN ('pending', 'replied')`,
      [params.id, userId]
    )

    return NextResponse.json({ released: rowCount || 0 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
