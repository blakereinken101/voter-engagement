import { NextResponse } from 'next/server'
import { getRequestContext, requireCampaignAdmin, handleAuthError, AuthError } from '@/lib/auth'
import { sendPushToCampaign } from '@/lib/push'

/** POST /api/push/send — admin-only endpoint to send push notifications to all campaign members */
export async function POST(request: Request) {
  try {
    const ctx = await getRequestContext()
    requireCampaignAdmin(ctx)

    const body = await request.json()
    const { title, body: messageBody, url } = body as {
      title: string
      body: string
      url?: string
    }

    if (!title?.trim() || !messageBody?.trim()) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      )
    }

    const result = await sendPushToCampaign(ctx.campaignId, {
      title: title.trim(),
      body: messageBody.trim(),
      url: url?.trim() || '/dashboard',
    })

    console.log(`[push/send] Admin ${ctx.userId} sent push to campaign ${ctx.campaignId}: ${result.sent} sent, ${result.failed} failed`)

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if (err instanceof AuthError) {
      const { error, status } = handleAuthError(err)
      return NextResponse.json({ error }, { status })
    }
    console.error('[push/send] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
