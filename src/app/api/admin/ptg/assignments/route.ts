import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext, requireRole, handleAuthError } from '@/lib/auth'
import { getDb, logActivity } from '@/lib/db'
import { ADMIN_ROLES } from '@/types'

/**
 * GET /api/admin/ptg/assignments
 * Returns organizers with their assigned volunteers.
 * Accessible by admins (full view) and organizers (scoped to own volunteers).
 */
export async function GET() {
  try {
    const ctx = await getRequestContext()
    requireRole(ctx, ...ADMIN_ROLES, 'organizer')
    const db = await getDb()
    const isAdmin = ADMIN_ROLES.includes(ctx.role) || ctx.isPlatformAdmin

    // Get all organizers
    const { rows: organizers } = await db.query(`
      SELECT DISTINCT u.id, u.name, m.role, m.region
      FROM users u
      JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $1
      WHERE m.role IN ('organizer', 'campaign_admin', 'org_owner')
         OR EXISTS (SELECT 1 FROM memberships m2 WHERE m2.organizer_id = u.id AND m2.campaign_id = $1)
      ORDER BY u.name
    `, [ctx.campaignId])

    // Get volunteers — scoped for organizer role
    let volQuery = `
      SELECT
        u.id, u.name, u.email, m.role, m.region, m.organizer_id,
        org_u.name as organizer_name,
        (SELECT COUNT(*) FROM contacts c WHERE c.user_id = u.id AND c.campaign_id = $1) as contact_count
      FROM users u
      JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $1
      LEFT JOIN users org_u ON org_u.id = m.organizer_id
      WHERE m.role IN ('volunteer', 'organizer')
    `
    const volParams: unknown[] = [ctx.campaignId]

    if (!isAdmin) {
      // Organizers see only their own volunteers + unassigned
      volQuery += ` AND (m.organizer_id = $2 OR m.organizer_id IS NULL)`
      volParams.push(ctx.userId)
    }

    volQuery += ` ORDER BY u.name`
    const { rows: volunteers } = await db.query(volQuery, volParams)

    // Group volunteers by organizer
    const orgMap = new Map<string | null, typeof volunteers>()
    for (const vol of volunteers) {
      const key = vol.organizer_id || null
      if (!orgMap.has(key)) orgMap.set(key, [])
      orgMap.get(key)!.push(vol)
    }

    return NextResponse.json({
      organizers: organizers.map((o: Record<string, unknown>) => ({
        id: o.id,
        name: o.name,
        role: o.role,
        region: o.region,
        volunteers: (orgMap.get(o.id as string) || []).map((v: Record<string, unknown>) => ({
          id: v.id,
          name: v.name,
          email: v.email,
          role: v.role,
          region: v.region,
          contactCount: Number(v.contact_count) || 0,
        })),
      })),
      unassigned: (orgMap.get(null) || []).map((v: Record<string, unknown>) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        role: v.role,
        region: v.region,
        contactCount: Number(v.contact_count) || 0,
      })),
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * PATCH /api/admin/ptg/assignments
 * Reassign a volunteer to a different organizer.
 * Admins can reassign anyone. Organizers can only reassign their own volunteers or unassigned ones.
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getRequestContext()
    requireRole(ctx, ...ADMIN_ROLES, 'organizer')
    const db = await getDb()
    const isAdmin = ADMIN_ROLES.includes(ctx.role) || ctx.isPlatformAdmin

    const body = await request.json()
    const { volunteerId, organizerId } = body as { volunteerId: string; organizerId: string | null }

    if (!volunteerId) {
      return NextResponse.json({ error: 'volunteerId is required' }, { status: 400 })
    }

    // Verify volunteer belongs to this campaign
    const { rows: volCheck } = await db.query(
      'SELECT id, organizer_id FROM memberships WHERE user_id = $1 AND campaign_id = $2',
      [volunteerId, ctx.campaignId],
    )
    if (volCheck.length === 0) {
      return NextResponse.json({ error: 'Volunteer not found in this campaign' }, { status: 404 })
    }

    // Organizer scope check
    if (!isAdmin) {
      const currentOrganizer = volCheck[0].organizer_id
      if (currentOrganizer && currentOrganizer !== ctx.userId) {
        return NextResponse.json({ error: 'Cannot reassign volunteers from other organizers' }, { status: 403 })
      }
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

    const previousOrganizerId = volCheck[0].organizer_id

    await db.query(
      'UPDATE memberships SET organizer_id = $1 WHERE user_id = $2 AND campaign_id = $3',
      [organizerId, volunteerId, ctx.campaignId],
    )

    // Get names for logging
    const { rows: [volUser] } = await db.query('SELECT name FROM users WHERE id = $1', [volunteerId])
    let orgName = 'Unassigned'
    if (organizerId) {
      const { rows: [orgUser] } = await db.query('SELECT name FROM users WHERE id = $1', [organizerId])
      orgName = orgUser?.name || 'Unknown'
    }

    await logActivity(ctx.userId, 'volunteer_reassigned', {
      volunteerId,
      volunteerName: volUser?.name,
      previousOrganizerId,
      newOrganizerId: organizerId,
      newOrganizerName: orgName,
    }, ctx.campaignId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
