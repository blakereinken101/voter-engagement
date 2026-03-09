import { NextRequest, NextResponse } from 'next/server'
import { handleInboundMessage } from '@/lib/texting-sms'

/**
 * Telnyx inbound SMS webhook.
 * Telnyx sends JSON POST with data.payload containing message details.
 * Configure this URL in the Telnyx Messaging Profile webhook settings.
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json()

    // Telnyx sends various event types; we only care about inbound messages
    const eventType = json?.data?.event_type
    if (eventType !== 'message.received') {
      return NextResponse.json({ ok: true })
    }

    const payload = json?.data?.payload
    const from = payload?.from?.phone_number
    const body = payload?.text
    const messageSid = payload?.id // Telnyx message ID

    if (!from || !body) {
      return NextResponse.json({ error: 'Missing from or body' }, { status: 400 })
    }

    const result = await handleInboundMessage(from, body, messageSid || '')

    // Telnyx does not support inline TwiML replies — send opt-out confirmation
    // as a separate outbound message via the SDK.
    if (result.optedOut) {
      const { sendSms } = await import('@/lib/sms')
      await sendSms(from, 'You have been unsubscribed and will not receive further messages.')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[texting-webhook] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
