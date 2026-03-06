import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { pdiFetch } from '@/lib/pdi-client'

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

    const pdiConfig = rows[0].settings?.pdiConfig || {}

    return NextResponse.json({
      pdiConfig: {
        enabled: pdiConfig.enabled || false,
        username: pdiConfig.username
          ? `${'*'.repeat(Math.max(0, pdiConfig.username.length - 4))}${pdiConfig.username.slice(-4)}`
          : '',
        hasUsername: !!pdiConfig.username,
        hasPassword: !!pdiConfig.password,
        apiToken: pdiConfig.apiToken
          ? `${'*'.repeat(Math.max(0, pdiConfig.apiToken.length - 4))}${pdiConfig.apiToken.slice(-4)}`
          : '',
        hasApiToken: !!pdiConfig.apiToken,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/pdi-config GET] Error:', error)
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

    const pdiInput = body.pdiConfig as Record<string, unknown> | undefined
    if (!pdiInput || typeof pdiInput !== 'object') {
      return NextResponse.json({ error: 'pdiConfig object is required' }, { status: 400 })
    }

    const { username, password, apiToken, enabled } = pdiInput

    const db = await getDb()

    // Read current config to merge
    const { rows } = await db.query('SELECT settings FROM campaigns WHERE id = $1', [ctx.campaignId])
    const current = rows[0]?.settings?.pdiConfig || {}

    const pdiConfig = {
      username: typeof username === 'string' && username.length > 0 ? username : current.username || '',
      password: typeof password === 'string' && password.length > 0 ? password : current.password || '',
      apiToken: typeof apiToken === 'string' && apiToken.length > 0 ? apiToken : current.apiToken || '',
      enabled: typeof enabled === 'boolean' ? enabled : current.enabled ?? false,
    }

    // If enabling PDI, disable VAN (one CRM per campaign)
    if (pdiConfig.enabled) {
      const vanConfig = rows[0]?.settings?.vanConfig
      if (vanConfig?.enabled) {
        await db.query(
          `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
          [JSON.stringify({ pdiConfig, vanConfig: { ...vanConfig, enabled: false } }), ctx.campaignId],
        )
        return NextResponse.json({ success: true, vanDisabled: true })
      }
    }

    await db.query(
      `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ pdiConfig }), ctx.campaignId],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/pdi-config PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Test PDI connection by authenticating and fetching contacts. */
export async function POST() {
  try {
    const ctx = await getRequestContext()

    if (ctx.role !== 'campaign_admin' && ctx.role !== 'org_owner' && ctx.role !== 'platform_admin' && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { status } = await pdiFetch(ctx.campaignId, 'GET', '/contacts?limit=1')

    if (status === 200) {
      return NextResponse.json({ success: true, message: 'Connection successful' })
    }

    return NextResponse.json(
      { success: false, message: `PDI returned HTTP ${status}` },
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
