import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

const VALID_EVENTS = ['contact.created', 'contact.updated', 'match.confirmed', 'match.rejected']

/**
 * GET /api/admin/ptg/webhooks
 * List webhook subscriptions for this campaign.
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { rows } = await db.query(
      'SELECT id, url, events, is_active, created_at, updated_at FROM webhooks WHERE campaign_id = $1 ORDER BY created_at DESC',
      [ctx.campaignId],
    )

    return NextResponse.json({
      webhooks: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        url: r.url,
        events: r.events,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * POST /api/admin/ptg/webhooks
 * Create a new webhook subscription.
 * Body: { url: string, events: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const body = await request.json()
    const { url, events } = body as { url: string; events: string[] }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 })
    }

    const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}` },
        { status: 400 },
      )
    }

    // Generate a signing secret
    const secret = crypto.randomBytes(32).toString('hex')

    const { rows } = await db.query(`
      INSERT INTO webhooks (campaign_id, url, events, secret)
      VALUES ($1, $2, $3, $4)
      RETURNING id, url, events, secret, is_active, created_at
    `, [ctx.campaignId, url, events, secret])

    const webhook = rows[0]

    return NextResponse.json({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Only returned on creation
        isActive: webhook.is_active,
        createdAt: webhook.created_at,
      },
    }, { status: 201 })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * DELETE /api/admin/ptg/webhooks
 * Delete a webhook subscription.
 * Body: { webhookId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const body = await request.json()
    const { webhookId } = body as { webhookId: string }

    if (!webhookId) {
      return NextResponse.json({ error: 'webhookId is required' }, { status: 400 })
    }

    const { rowCount } = await db.query(
      'DELETE FROM webhooks WHERE id = $1 AND campaign_id = $2',
      [webhookId, ctx.campaignId],
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
