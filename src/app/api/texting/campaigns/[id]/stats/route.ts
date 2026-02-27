import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignMember } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'
import type { TextCampaignStats } from '@/types/texting'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignMember(params.id, ctx.userId, ctx.isPlatformAdmin)

    const pool = getPool()

    const { rows: contactStats } = await pool.query(`
      SELECT
        COUNT(*) AS total_contacts,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'replied') AS replied,
        COUNT(*) FILTER (WHERE status = 'opted_out') AS opted_out,
        COUNT(*) FILTER (WHERE status = 'error') AS errors
      FROM text_campaign_contacts
      WHERE text_campaign_id = $1
    `, [params.id])

    const { rows: messageStats } = await pool.query(`
      SELECT
        COUNT(*) AS total_messages,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound
      FROM text_messages
      WHERE text_campaign_id = $1
    `, [params.id])

    const stats: TextCampaignStats = {
      totalContacts: parseInt(contactStats[0].total_contacts, 10),
      pending: parseInt(contactStats[0].pending, 10),
      sent: parseInt(contactStats[0].sent, 10),
      replied: parseInt(contactStats[0].replied, 10),
      optedOut: parseInt(contactStats[0].opted_out, 10),
      errors: parseInt(contactStats[0].errors, 10),
      totalMessages: parseInt(messageStats[0].total_messages, 10),
      delivered: parseInt(messageStats[0].delivered, 10),
      failed: parseInt(messageStats[0].failed, 10),
      inbound: parseInt(messageStats[0].inbound, 10),
    }

    return NextResponse.json({ stats })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
