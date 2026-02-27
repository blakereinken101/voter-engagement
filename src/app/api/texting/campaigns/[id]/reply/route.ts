import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignMember, interpolateScript, mapContactRow, mapScriptRow, mapMessageRow } from '@/lib/texting'
import { sendTextCampaignReply } from '@/lib/texting-sms'
import { handleAuthError } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignMember(params.id, ctx.userId, ctx.isPlatformAdmin)

    const body = await request.json()
    const { contactId, body: replyBody, scriptId } = body

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    const pool = getPool()

    // Get the contact
    const { rows: contactRows } = await pool.query(
      'SELECT * FROM text_campaign_contacts WHERE id = $1 AND text_campaign_id = $2',
      [contactId, params.id]
    )
    if (contactRows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    const contact = mapContactRow(contactRows[0])

    // Determine message body
    let messageBody: string
    if (scriptId) {
      const { rows: scriptRows } = await pool.query(
        'SELECT * FROM text_campaign_scripts WHERE id = $1 AND text_campaign_id = $2',
        [scriptId, params.id]
      )
      if (scriptRows.length === 0) {
        return NextResponse.json({ error: 'Script not found' }, { status: 404 })
      }
      const script = mapScriptRow(scriptRows[0])
      messageBody = interpolateScript(script.body, contact)
    } else if (replyBody?.trim()) {
      messageBody = replyBody.trim()
    } else {
      return NextResponse.json({ error: 'Reply body or scriptId is required' }, { status: 400 })
    }

    const result = await sendTextCampaignReply(
      contactId,
      params.id,
      ctx.userId,
      messageBody,
      ctx.organizationId,
    )

    // Return updated conversation thread
    const { rows: messageRows } = await pool.query(
      `SELECT * FROM text_messages
       WHERE contact_id = $1 AND text_campaign_id = $2
       ORDER BY created_at ASC`,
      [contactId, params.id]
    )

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      messages: messageRows.map(mapMessageRow),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('opted out')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
