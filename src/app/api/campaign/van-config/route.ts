import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { vanFetch } from '@/lib/van-client'

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

    const vanConfig = rows[0].settings?.vanConfig || {}

    return NextResponse.json({
      vanConfig: {
        enabled: vanConfig.enabled || false,
        mode: vanConfig.mode ?? 1,
        apiKey: vanConfig.apiKey
          ? `${'*'.repeat(Math.max(0, vanConfig.apiKey.length - 4))}${vanConfig.apiKey.slice(-4)}`
          : '',
        hasApiKey: !!vanConfig.apiKey,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/van-config GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getRequestContext()

    if (ctx.role !== 'campaign_admin' && ctx.role !== 'org_owner' && ctx.role !== 'platform_admin' && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const vanInput = body.vanConfig as Record<string, unknown> | undefined
    if (!vanInput || typeof vanInput !== 'object') {
      return NextResponse.json({ error: 'vanConfig object is required' }, { status: 400 })
    }

    const { apiKey, mode, enabled } = vanInput

    if (mode !== undefined && mode !== 0 && mode !== 1) {
      return NextResponse.json({ error: 'mode must be 0 or 1' }, { status: 400 })
    }

    const db = await getDb()

    // Read current config to merge
    const { rows } = await db.query('SELECT settings FROM campaigns WHERE id = $1', [ctx.campaignId])
    const current = rows[0]?.settings?.vanConfig || {}

    const vanConfig = {
      apiKey: typeof apiKey === 'string' && apiKey.length > 0 ? apiKey : current.apiKey || '',
      mode: mode ?? current.mode ?? 1,
      enabled: typeof enabled === 'boolean' ? enabled : current.enabled ?? false,
    }

    await db.query(
      `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ vanConfig }), ctx.campaignId],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/van-config PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Test VAN connection by fetching contact types. */
export async function POST() {
  try {
    const ctx = await getRequestContext()

    if (ctx.role !== 'campaign_admin' && ctx.role !== 'org_owner' && ctx.role !== 'platform_admin' && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { status, data } = await vanFetch(ctx.campaignId, 'GET', '/canvassResponses/contactTypes')

    if (status === 200) {
      return NextResponse.json({ success: true, message: 'Connection successful' })
    }

    return NextResponse.json(
      { success: false, message: `VAN returned HTTP ${status}` },
      { status: 400 },
    )
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Connection failed' },
      { status: 400 },
    )
  }
}
