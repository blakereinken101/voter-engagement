import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getEventsContext } from '@/lib/events'
import { AuthError, handleAuthError } from '@/lib/auth'

/**
 * PUT /api/organizations/logo
 * Upload or update the organization's logo.
 * Accepts a base64 data URL, same pattern as event cover images.
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await getEventsContext()
    const db = await getDb()

    const body = await request.json()
    const { logoUrl } = body

    if (!logoUrl || typeof logoUrl !== 'string') {
      return NextResponse.json({ error: 'logoUrl is required' }, { status: 400 })
    }

    // Validate it's an image data URL or a valid URL
    if (logoUrl.startsWith('data:')) {
      if (!logoUrl.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
      }
      // Check approximate size (base64 is ~4/3 of original, so 1MB original ≈ 1.33MB base64)
      if (logoUrl.length > 1.5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Logo must be under 1MB' }, { status: 400 })
      }
    }

    await db.query(
      'UPDATE organizations SET logo_url = $1 WHERE id = $2',
      [logoUrl, ctx.organizationId]
    )

    return NextResponse.json({ success: true, logoUrl })
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error)
    console.error('[organizations/logo] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/organizations/logo
 * Get the current organization's logo URL.
 */
export async function GET() {
  try {
    const ctx = await getEventsContext()
    const db = await getDb()

    const { rows } = await db.query(
      'SELECT logo_url FROM organizations WHERE id = $1',
      [ctx.organizationId]
    )

    return NextResponse.json({
      logoUrl: rows[0]?.logo_url || null,
      customBranding: ctx.subscription?.limits?.customBranding || false,
    })
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error)
    console.error('[organizations/logo] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
