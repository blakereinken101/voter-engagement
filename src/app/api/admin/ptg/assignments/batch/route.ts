import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext, requireRole, handleAuthError } from '@/lib/auth'
import { getDb, logActivity } from '@/lib/db'
import { ADMIN_ROLES } from '@/types'

/**
 * POST /api/admin/ptg/assignments/batch
 * Bulk reassign volunteers to a new organizer.
 * Body: { volunteerIds: string[], organizerId: string | null }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getRequestContext()
    requireRole(ctx, ...ADMIN_ROLES, 'organizer')
    const db = await getDb()
    const isAdmin = ADMIN_ROLES.includes(ctx.role) || ctx.isPlatformAdmin

    const body = await request.json()
    const { volunteerIds, organizerId } = body as { volunteerIds: string[]; organizerId: string | null }

    if (!volunteerIds || !Array.isArray(volunteerIds) || volunteerIds.length === 0) {
      return NextResponse.json({ error: 'volunteerIds array is required' }, { status: 400 })
    }

    // Verify target organizer exists (if not unassigning)
    if (organizerId) {
      const { rows: orgCheck } = await db.query(
        'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2',
        [organizerId, ctx.campaignId],
      )
      if (orgCheck.length === 0) {
        return NextResponse.json({ error: 'Organizer not found in this campaign' }, { status: 404 })
      }
    }

    let reassigned = 0

    for (const volunteerId of volunteerIds) {
      // Verify volunteer + scope check
      const { rows: volCheck } = await db.query(
        'SELECT id, organizer_id FROM memberships WHERE user_id = $1 AND campaign_id = $2',
        [volunteerId, ctx.campaignId],
      )
      if (volCheck.length === 0) continue

      // Organizer scope check
      if (!isAdmin) {
        const currentOrganizer = volCheck[0].organizer_id
        if (currentOrganizer && currentOrganizer !== ctx.userId) continue
      }

      await db.query(
        'UPDATE memberships SET organizer_id = $1 WHERE user_id = $2 AND campaign_id = $3',
        [organizerId, volunteerId, ctx.campaignId],
      )
      reassigned++
    }

    await logActivity(ctx.userId, 'volunteers_bulk_reassigned', {
      volunteerIds,
      newOrganizerId: organizerId,
      count: reassigned,
    }, ctx.campaignId)

    return NextResponse.json({ success: true, reassigned })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
