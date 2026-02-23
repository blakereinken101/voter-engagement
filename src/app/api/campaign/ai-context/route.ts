import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import type { AICampaignContext } from '@/types'

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
    const aiContext = (settings.aiContext || {}) as AICampaignContext

    return NextResponse.json({ aiContext })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/ai-context GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getRequestContext()

    // Admin-only
    if (ctx.role !== 'campaign_admin' && ctx.role !== 'org_owner' && ctx.role !== 'platform_admin' && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    let body: { aiContext: AICampaignContext }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.aiContext || typeof body.aiContext !== 'object') {
      return NextResponse.json({ error: 'aiContext object is required' }, { status: 400 })
    }

    // Sanitize inputs
    const sanitize = (val: unknown, maxLen = 5000): string | undefined =>
      typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) || undefined : undefined

    const aiContext: AICampaignContext = {
      goals: sanitize(body.aiContext.goals),
      keyIssues: Array.isArray(body.aiContext.keyIssues)
        ? body.aiContext.keyIssues.filter((i): i is string => typeof i === 'string').map(i => i.slice(0, 200)).slice(0, 20)
        : undefined,
      talkingPoints: Array.isArray(body.aiContext.talkingPoints)
        ? body.aiContext.talkingPoints.filter((i): i is string => typeof i === 'string').map(i => i.slice(0, 500)).slice(0, 20)
        : undefined,
      messagingGuidance: sanitize(body.aiContext.messagingGuidance),
    }

    const db = await getDb()

    // Merge into existing settings JSONB
    await db.query(
      `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ aiContext }), ctx.campaignId],
    )

    return NextResponse.json({ success: true, aiContext })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/ai-context PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
