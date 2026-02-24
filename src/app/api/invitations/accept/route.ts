import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { hashPassword, createSessionToken, createPendingToken, generateVerificationCode, getSessionFromRequest } from '@/lib/auth'
import { sendVerificationCode } from '@/lib/email'
import crypto from 'crypto'

/**
 * GET /api/invitations/accept?token=xxx — get invitation details (for the invite page)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

    const db = await getDb()

    const { rows } = await db.query(`
      SELECT i.*, c.name as campaign_name, c.candidate_name, c.state,
             o.name as org_name, u.name as inviter_name
      FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN organizations o ON o.id = c.org_id
      JOIN users u ON u.id = i.invited_by
      WHERE i.token = $1
    `, [token])

    if (!rows[0]) return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })

    const invitation = rows[0]

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
    }

    // Check usage
    if (invitation.use_count >= invitation.max_uses) {
      return NextResponse.json({ error: 'This invitation has reached its maximum uses' }, { status: 410 })
    }

    // Check if already accepted (for single-use email invites)
    if (invitation.max_uses === 1 && invitation.accepted_at) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 410 })
    }

    return NextResponse.json({
      invitation: {
        campaignName: invitation.campaign_name,
        candidateName: invitation.candidate_name,
        orgName: invitation.org_name,
        inviterName: invitation.inviter_name,
        role: invitation.role,
        email: invitation.email,
        state: invitation.state,
      }
    })
  } catch (error) {
    console.error('[invitations/accept GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/invitations/accept — accept an invitation
 * Body: { token, name?, email?, password? }
 * If user is already signed in, just creates the membership.
 * If not, creates account + membership.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, name, email, password } = body

    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

    const db = await getDb()

    // Look up invitation
    const { rows: invRows } = await db.query(`
      SELECT i.*, c.name as campaign_name
      FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      WHERE i.token = $1
    `, [token])

    if (!invRows[0]) return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })

    const invitation = invRows[0]

    // Validate invitation is still valid
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
    }
    if (invitation.use_count >= invitation.max_uses) {
      return NextResponse.json({ error: 'This invitation has reached its maximum uses' }, { status: 410 })
    }

    // Check if user is already signed in
    const session = getSessionFromRequest()
    let userId: string
    let userEmail: string
    let userName: string
    let isNewUser = false

    if (session) {
      // Existing signed-in user — just create membership
      userId = session.userId
      const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [userId])
      if (!userRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 401 })
      userEmail = userRows[0].email as string
      userName = userRows[0].name as string
    } else {
      // New user — validate required fields
      if (!name || !email || !password) {
        return NextResponse.json({ error: 'Name, email, and password are required for new accounts' }, { status: 400 })
      }
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }

      const normalizedEmail = email.toLowerCase().trim()

      // If invitation has a specific email, verify it matches
      if (invitation.email && invitation.email !== normalizedEmail) {
        return NextResponse.json({ error: 'This invitation is for a different email address' }, { status: 403 })
      }

      // Check if user already exists
      const { rows: existingUser } = await db.query('SELECT id, email, name FROM users WHERE email = $1', [normalizedEmail])

      if (existingUser[0]) {
        // User exists but isn't signed in — they need to sign in first
        return NextResponse.json({
          error: 'An account with this email already exists. Please sign in first, then use the invite link.',
          existingUser: true,
        }, { status: 409 })
      }

      // Create new user
      userId = crypto.randomUUID()
      const passwordHash = hashPassword(password)
      await db.query(
        `INSERT INTO users (id, email, password_hash, name, is_platform_admin)
         VALUES ($1, $2, $3, $4, false)`,
        [userId, normalizedEmail, passwordHash, name.trim()]
      )
      userEmail = normalizedEmail
      userName = name.trim()
      isNewUser = true
    }

    // Check if membership already exists
    const { rows: existingMembership } = await db.query(
      'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2',
      [userId, invitation.campaign_id]
    )

    if (existingMembership[0]) {
      return NextResponse.json({
        error: 'You are already a member of this campaign',
        alreadyMember: true,
      }, { status: 409 })
    }

    // Create membership
    await db.query(
      `INSERT INTO memberships (id, user_id, campaign_id, role, invited_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), userId, invitation.campaign_id, invitation.role, invitation.invited_by]
    )

    // Grant relational product access (invitations are always for the relational product)
    await db.query(
      `INSERT INTO user_products (id, user_id, product, granted_by)
       VALUES ($1, $2, 'relational', $3)
       ON CONFLICT (user_id, product) DO UPDATE SET is_active = true`,
      [crypto.randomUUID(), userId, invitation.invited_by]
    )

    // Update invitation usage
    await db.query(
      `UPDATE invitations SET use_count = use_count + 1, accepted_at = NOW() WHERE id = $1`,
      [invitation.id]
    )

    await logActivity(userId, 'accept_invitation', {
      invitationId: invitation.id,
      campaignId: invitation.campaign_id,
      role: invitation.role,
    })

    if (session) {
      // Already signed in — re-issue session token with updated products
      const { rows: productRows } = await db.query(
        `SELECT product FROM user_products WHERE user_id = $1 AND is_active = true`,
        [userId]
      )
      const products = productRows.map((r: { product: string }) => r.product)
      const sessionToken = createSessionToken({ userId, email: userEmail, products })

      const response = NextResponse.json({
        success: true,
        user: { id: userId, email: userEmail, name: userName },
        campaignId: invitation.campaign_id,
        campaignName: invitation.campaign_name,
        isNewUser,
      })

      response.headers.append('Set-Cookie', `vc-session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`)
      response.headers.append('Set-Cookie', `vc-campaign=${invitation.campaign_id}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`)

      return response
    }

    // New user — require 2FA verification before full session
    const code = generateVerificationCode()
    const codeId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await db.query(
      `INSERT INTO verification_codes (id, user_id, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [codeId, userId, code, expiresAt.toISOString()]
    )

    await sendVerificationCode(userEmail, code)

    const pendingToken = createPendingToken(userId, userEmail)

    const response = NextResponse.json({
      success: true,
      requiresVerification: true,
      campaignId: invitation.campaign_id,
      campaignName: invitation.campaign_name,
      isNewUser,
    })

    response.headers.append('Set-Cookie', `vc-2fa-pending=${pendingToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
    response.headers.append('Set-Cookie', `vc-campaign=${invitation.campaign_id}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`)

    return response
  } catch (error) {
    console.error('[invitations/accept POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
