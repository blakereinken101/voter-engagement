import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext, handleAuthError, AuthError } from '@/lib/auth'
import { sendDemoConfirmationToProspect } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getRequestContext()
    if (!ctx.isPlatformAdmin) {
      throw new AuthError('Platform admin access required', 403)
    }

    const body = await request.json()
    const { name, email, organization } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    await sendDemoConfirmationToProspect({
      name,
      email,
      organization,
      role: 'Interested Lead',
      attendeeCount: 'Just me',
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
