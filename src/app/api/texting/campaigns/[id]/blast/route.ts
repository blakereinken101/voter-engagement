import { NextRequest, NextResponse } from 'next/server'
import { getTextingContext, requireTextCampaignAdmin } from '@/lib/texting'
import { sendBlastMessages } from '@/lib/texting-sms'
import { handleAuthError } from '@/lib/auth'
import { getPool } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)

    const pool = getPool()

    // Verify campaign is active and in blast mode
    const { rows: campaignRows } = await pool.query(
      'SELECT status, sending_mode FROM text_campaigns WHERE id = $1',
      [params.id]
    )
    if (campaignRows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaignRows[0].status !== 'active') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 })
    }

    const body = await request.json()
    const batchSize = body.batchSize || 50

    const result = await sendBlastMessages(
      params.id,
      ctx.organizationId,
      ctx.userId,
      batchSize,
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
