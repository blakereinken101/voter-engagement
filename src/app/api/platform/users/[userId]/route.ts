import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { userId } = await params
    const db = await getDb()

    // User info
    const { rows: userRows } = await db.query(
      'SELECT id, email, name, phone, is_platform_admin, created_at FROM users WHERE id = $1',
      [userId]
    )
    if (!userRows[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Products
    const { rows: productRows } = await db.query(
      `SELECT product, granted_at, is_active FROM user_products WHERE user_id = $1 ORDER BY granted_at`,
      [userId]
    )

    // Relational memberships
    const { rows: membershipRows } = await db.query(`
      SELECT m.id, m.role, m.is_active, m.joined_at,
             c.name as campaign_name, c.slug as campaign_slug, c.id as campaign_id,
             o.name as org_name
      FROM memberships m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN organizations o ON o.id = c.org_id
      WHERE m.user_id = $1
      ORDER BY m.joined_at DESC
    `, [userId])

    // Texting campaign memberships
    const { rows: textMemberRows } = await db.query(`
      SELECT tcm.id, tcm.role, tcm.is_active, tcm.joined_at,
             tc.title as campaign_title, tc.id as campaign_id, tc.status as campaign_status
      FROM text_campaign_members tcm
      JOIN text_campaigns tc ON tc.id = tcm.text_campaign_id
      WHERE tcm.user_id = $1
      ORDER BY tcm.joined_at DESC
    `, [userId])

    return NextResponse.json({
      user: userRows[0],
      products: productRows,
      memberships: membershipRows,
      textCampaignMemberships: textMemberRows,
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requirePlatformAdmin()
    const { userId } = await params
    const db = await getDb()

    const body = await request.json()

    // Toggle platform admin
    if (typeof body.is_platform_admin === 'boolean') {
      if (session.userId === userId) {
        return NextResponse.json({ error: 'Cannot modify your own admin status' }, { status: 400 })
      }

      const { rows } = await db.query(
        'UPDATE users SET is_platform_admin = $1 WHERE id = $2 RETURNING id, email, name, is_platform_admin',
        [body.is_platform_admin, userId]
      )

      if (!rows[0]) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      return NextResponse.json({ user: rows[0] })
    }

    // Grant a product
    if (body.grantProduct) {
      const product = body.grantProduct
      const validProducts = ['events', 'relational', 'texting']
      if (!validProducts.includes(product)) {
        return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
      }

      // Check if already granted
      const { rows: existing } = await db.query(
        'SELECT id, is_active FROM user_products WHERE user_id = $1 AND product = $2',
        [userId, product]
      )

      if (existing.length > 0) {
        if (!existing[0].is_active) {
          // Re-activate
          await db.query(
            'UPDATE user_products SET is_active = true, granted_by = $1 WHERE id = $2',
            [session.userId, existing[0].id]
          )
        }
        // Already active — no-op
      } else {
        await db.query(
          'INSERT INTO user_products (id, user_id, product, granted_by) VALUES ($1, $2, $3, $4)',
          [crypto.randomUUID(), userId, product, session.userId]
        )
      }

      return NextResponse.json({ success: true })
    }

    // Revoke a product
    if (body.revokeProduct) {
      const product = body.revokeProduct
      await db.query(
        'UPDATE user_products SET is_active = false WHERE user_id = $1 AND product = $2',
        [userId, product]
      )
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'No valid action specified' }, { status: 400 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
