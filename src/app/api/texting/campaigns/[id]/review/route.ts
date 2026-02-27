import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignAdmin, mapContactRow, mapMessageRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

/** Get conversations for message review. */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)

    const pool = getPool()
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const assignedTo = url.searchParams.get('assignedTo')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = (page - 1) * limit

    let where = 'WHERE tcc.text_campaign_id = $1'
    const values: unknown[] = [params.id]
    let idx = 2

    if (status) { where += ` AND tcc.status = $${idx++}`; values.push(status) }
    if (assignedTo) { where += ` AND tcc.assigned_to = $${idx++}`; values.push(assignedTo) }

    // Get contacts with their latest message
    const { rows } = await pool.query(`
      SELECT tcc.*,
        lm.body AS last_message_body,
        lm.direction AS last_message_direction,
        lm.created_at AS last_message_at,
        (SELECT COUNT(*) FROM text_messages tm WHERE tm.contact_id = tcc.id) AS message_count,
        u.name AS assigned_to_name
      FROM text_campaign_contacts tcc
      LEFT JOIN LATERAL (
        SELECT body, direction, created_at FROM text_messages
        WHERE contact_id = tcc.id ORDER BY created_at DESC LIMIT 1
      ) lm ON true
      LEFT JOIN users u ON u.id = tcc.assigned_to
      ${where}
      ORDER BY lm.created_at DESC NULLS LAST
      LIMIT $${idx++} OFFSET $${idx}
    `, [...values, limit, offset])

    const conversations = rows.map(row => ({
      contact: mapContactRow(row),
      lastMessageBody: row.last_message_body,
      lastMessageDirection: row.last_message_direction,
      lastMessageAt: row.last_message_at?.toISOString?.() || row.last_message_at,
      messageCount: parseInt(row.message_count, 10),
      assignedToName: row.assigned_to_name,
    }))

    return NextResponse.json({ conversations })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** Get the full message thread for a specific contact. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)

    const body = await request.json()
    const { contactId } = body

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    const pool = getPool()
    const { rows: contactRows } = await pool.query(
      'SELECT * FROM text_campaign_contacts WHERE id = $1 AND text_campaign_id = $2',
      [contactId, params.id]
    )
    if (contactRows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { rows: messageRows } = await pool.query(
      `SELECT tm.*, u.name AS sender_name
       FROM text_messages tm
       LEFT JOIN users u ON u.id = tm.sender_id
       WHERE tm.contact_id = $1 AND tm.text_campaign_id = $2
       ORDER BY tm.created_at ASC`,
      [contactId, params.id]
    )

    return NextResponse.json({
      contact: mapContactRow(contactRows[0]),
      messages: messageRows.map(row => ({
        ...mapMessageRow(row),
        senderName: row.sender_name,
      })),
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
