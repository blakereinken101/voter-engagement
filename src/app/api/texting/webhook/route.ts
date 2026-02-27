import { NextRequest, NextResponse } from 'next/server'
import { handleInboundMessage } from '@/lib/texting-sms'

/**
 * Twilio inbound SMS webhook.
 * Twilio sends form-encoded POST with From, Body, MessageSid, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    if (!from || !body) {
      return new NextResponse('', { status: 400 })
    }

    const result = await handleInboundMessage(from, body, messageSid || '')

    // Return TwiML response
    if (result.optedOut) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed and will not receive further messages.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Empty TwiML response (no auto-reply)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (error) {
    console.error('[texting-webhook] Error:', error)
    return new NextResponse('', { status: 500 })
  }
}
