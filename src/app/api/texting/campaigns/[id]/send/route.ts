import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignMember, interpolateScript, mapContactRow, mapScriptRow } from '@/lib/texting'
import { sendTextCampaignMessage } from '@/lib/texting-sms'
import { handleAuthError } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignMember(params.id, ctx.userId, ctx.isPlatformAdmin)

    const body = await request.json()
    const { contactId } = body

    const pool = getPool()

    // Verify campaign is active
    const { rows: campaignRows } = await pool.query(
      'SELECT status FROM text_campaigns WHERE id = $1',
      [params.id]
    )
    if (campaignRows.length === 0 || campaignRows[0].status !== 'active') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 })
    }

    // Get the contact
    const { rows: contactRows } = await pool.query(
      'SELECT * FROM text_campaign_contacts WHERE id = $1 AND text_campaign_id = $2',
      [contactId, params.id]
    )
    if (contactRows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    const contact = mapContactRow(contactRows[0])

    // Verify the texter has this contact assigned (or is admin)
    if (contact.assignedTo !== ctx.userId && !ctx.isPlatformAdmin) {
      // Check if they're an admin
      const { rows: memberRows } = await pool.query(
        `SELECT role FROM text_campaign_members WHERE text_campaign_id = $1 AND user_id = $2`,
        [params.id, ctx.userId]
      )
      const isAdmin = memberRows.length > 0 && memberRows[0].role === 'admin'
      if (!isAdmin) {
        return NextResponse.json({ error: 'Contact not assigned to you' }, { status: 403 })
      }
    }

    // Get initial script
    const { rows: scriptRows } = await pool.query(
      `SELECT * FROM text_campaign_scripts
       WHERE text_campaign_id = $1 AND script_type = 'initial' AND is_active = true
       ORDER BY sort_order ASC LIMIT 1`,
      [params.id]
    )
    if (scriptRows.length === 0) {
      return NextResponse.json({ error: 'No initial script configured' }, { status: 400 })
    }

    const script = mapScriptRow(scriptRows[0])
    const messageBody = interpolateScript(script.body, contact)

    const result = await sendTextCampaignMessage(
      contactId,
      params.id,
      ctx.userId,
      messageBody,
      ctx.organizationId,
    )

    // Get next pending contact assigned to this texter
    const { rows: nextRows } = await pool.query(
      `SELECT * FROM text_campaign_contacts
       WHERE text_campaign_id = $1 AND assigned_to = $2 AND status = 'pending'
       ORDER BY created_at ASC LIMIT 1`,
      [params.id, ctx.userId]
    )

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      nextContact: nextRows.length > 0 ? mapContactRow(nextRows[0]) : null,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('opted out')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
