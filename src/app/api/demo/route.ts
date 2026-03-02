import { NextRequest, NextResponse } from 'next/server'
import { sendDemoLeadNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, organization, role, attendeeCount, notes } = body

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

    return NextResponse.json({ submitted: true })
  } catch (error) {
    console.error('[api/demo] Error:', error)
    return NextResponse.json({ error: 'Failed to submit demo request' }, { status: 500 })
  }
}
