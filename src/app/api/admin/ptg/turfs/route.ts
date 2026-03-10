import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/turfs
 * List all turfs for the current campaign.
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { rows } = await db.query(`
      SELECT t.id, t.name, t.description, t.organizer_id, t.region, t.boundaries, t.created_at,
             u.name as organizer_name
      FROM turfs t
      LEFT JOIN users u ON u.id = t.organizer_id
      WHERE t.campaign_id = $1
      ORDER BY t.region NULLS LAST, t.name
    `, [ctx.campaignId])

    const turfs = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      campaignId: ctx.campaignId,
      name: r.name,
      description: r.description || null,
      organizerId: r.organizer_id || null,
      organizerName: r.organizer_name || null,
      region: r.region || null,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ turfs })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * PUT /api/admin/ptg/turfs
 * Create/update/delete turfs. Body: { turfs: Array<{ id?, name, description?, organizerId?, region?, delete? }> }
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const body = await request.json()
    const turfs = body.turfs as Array<{
      id?: string
      name: string
      description?: string
      organizerId?: string
      region?: string
      delete?: boolean
    }>

    if (!Array.isArray(turfs)) {
      return NextResponse.json({ error: 'turfs array required' }, { status: 400 })
    }

    for (const turf of turfs) {
      if (turf.delete && turf.id) {
        // Unlink contacts from this turf first
        await db.query('UPDATE contacts SET turf_id = NULL WHERE turf_id = $1', [turf.id])
        await db.query('DELETE FROM turfs WHERE id = $1 AND campaign_id = $2', [turf.id, ctx.campaignId])
      } else if (turf.id) {
        // Update existing
        await db.query(`
          UPDATE turfs SET name = $1, description = $2, organizer_id = $3, region = $4
          WHERE id = $5 AND campaign_id = $6
        `, [turf.name, turf.description || null, turf.organizerId || null, turf.region || null, turf.id, ctx.campaignId])
      } else {
        // Create new
        await db.query(`
          INSERT INTO turfs (id, campaign_id, name, description, organizer_id, region)
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
        `, [ctx.campaignId, turf.name, turf.description || null, turf.organizerId || null, turf.region || null])
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
