import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getRequestContext, requireCampaignAdmin, handleAuthError, getSessionFromRequest, hashPassword, createSessionToken } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/email'
import crypto from 'crypto'
import { ADMIN_ROLES, MembershipRole } from '@/types'

const VALID_ROLES: MembershipRole[] = ['volunteer', 'organizer', 'campaign_admin']

/**
 * GET /api/invitations — list invitations for active campaign
 */
export async function GET() {
  try {
    const ctx = await getRequestContext()
    requireCampaignAdmin(ctx)

    const db = await getDb()
    const { rows } = await db.query(`
      SELECT i.*, c.name as campaign_name, u.name as inviter_name
      FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN users u ON u.id = i.invited_by
      WHERE i.campaign_id = $1
      ORDER BY i.created_at DESC
    `, [ctx.campaignId])

    return NextResponse.json({ invitations: rows })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * POST /api/invitations — create a new invitation
 * Body: { email?, role, maxUses?, expiresInDays? }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getRequestContext()
    requireCampaignAdmin(ctx)

    const body = await request.json()
    const { email, role, maxUses, expiresInDays } = body

    // Validate role
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
    }

    // Non-platform-admins can't create admin invites
    if (ADMIN_ROLES.includes(role) && !ctx.isPlatformAdmin && ctx.role !== 'org_owner') {
      // campaign_admins can create other campaign_admins
      if (role !== 'campaign_admin' || ctx.role !== 'campaign_admin') {
        return NextResponse.json({ error: 'Cannot create invitations with higher role than your own' }, { status: 403 })
      }
    }

    const db = await getDb()
    const id = crypto.randomUUID()
    const token = crypto.randomBytes(32).toString('hex')
    const days = Math.min(Math.max(expiresInDays || 7, 1), 90)
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    const uses = Math.min(Math.max(maxUses || 1, 1), 1000)
    const normalizedEmail = email ? email.toLowerCase().trim() : null

    await db.query(`
      INSERT INTO invitations (id, campaign_id, email, role, token, invited_by, expires_at, max_uses)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, ctx.campaignId, normalizedEmail, role, token, ctx.userId, expiresAt, uses])

    await logActivity(ctx.userId, 'create_invitation', {
      invitationId: id,
      email: normalizedEmail,
      role,
      maxUses: uses,
    })

    // Send invitation email if an email address was provided
    if (normalizedEmail) {
      const { rows: inviterRows } = await db.query('SELECT name FROM users WHERE id = $1', [ctx.userId])
      const { rows: campaignRows } = await db.query('SELECT name FROM campaigns WHERE id = $1', [ctx.campaignId])
      const inviterName = inviterRows[0]?.name || 'Someone'
      const campaignName = campaignRows[0]?.name || 'a campaign'

      await sendInvitationEmail({
        email: normalizedEmail,
        inviterName,
        campaignName,
        role,
        inviteToken: token,
      })
    }

    return NextResponse.json({
      invitation: {
        id,
        token,
        email: normalizedEmail,
        role,
        expiresAt,
        maxUses: uses,
        inviteUrl: `/invite/${token}`,
      }
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * DELETE /api/invitations?id=xxx — revoke an invitation
 */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getRequestContext()
    requireCampaignAdmin(ctx)

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('id')
    if (!invitationId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = await getDb()

    // Verify invitation belongs to this campaign
    const { rows } = await db.query(
      'SELECT id FROM invitations WHERE id = $1 AND campaign_id = $2',
      [invitationId, ctx.campaignId]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })

    await db.query('DELETE FROM invitations WHERE id = $1', [invitationId])

    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
