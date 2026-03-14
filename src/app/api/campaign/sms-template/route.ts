import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { invalidateConfigCache } from '@/lib/campaign-config.server'

export async function GET() {
  try {
    const ctx = await getRequestContext()
    const db = await getDb()

    const { rows } = await db.query(
      'SELECT settings FROM campaigns WHERE id = $1',
      [ctx.campaignId],
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const settings = (rows[0].settings || {}) as Record<string, unknown>
    return NextResponse.json({ customSmsTemplate: settings.customSmsTemplate || '' })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/sms-template GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getRequestContext()

    // Admin or organizer access required
    if (
      ctx.role !== 'campaign_admin' &&
      ctx.role !== 'org_owner' &&
      ctx.role !== 'platform_admin' &&
      ctx.role !== 'organizer' &&
      !ctx.isPlatformAdmin
    ) {
      return NextResponse.json({ error: 'Admin or organizer access required' }, { status: 403 })
    }

    let body: { customSmsTemplate?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const template = typeof body.customSmsTemplate === 'string'
      ? body.customSmsTemplate.replace(/<[^>]*>/g, '').trim().slice(0, 2000)
      : ''

    const db = await getDb()
    await db.query(
      `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ customSmsTemplate: template || null }), ctx.campaignId],
    )

    invalidateConfigCache(ctx.campaignId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/sms-template PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
