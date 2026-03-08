import { NextRequest, NextResponse } from 'next/server'
import { sendDemoLeadNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, organization, role, attendeeCount, notes, gclid } = body

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 })
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const leadData = { name, email, organization, role, attendeeCount: attendeeCount || 'Just me', notes }

    // Send internal notification
    await sendDemoLeadNotification(leadData)

    // Report conversion to Google Ads (server-side backup)
    if (process.env.GOOGLE_ADS_CUSTOMER_ID) {
      try {
        const appUrl = process.env.APP_URL || 'http://localhost:3000'
        await fetch(`${appUrl}/api/ads/conversion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.CRON_SECRET || '',
          },
          body: JSON.stringify({
            gclid: gclid || undefined,
            email,
            conversionValue: 100,
          }),
        })
      } catch (convErr) {
        // Don't fail the demo submission if conversion tracking fails
        console.warn('[api/demo] Conversion tracking failed:', convErr)
      }
    }

    return NextResponse.json({ submitted: true })
  } catch (error) {
    console.error('[api/demo] Error:', error)
    return NextResponse.json({ error: 'Failed to submit demo request' }, { status: 500 })
  }
}
