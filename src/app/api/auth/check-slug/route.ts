import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sanitizeSlug, validateSlug } from '@/lib/slugs'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ available: false, error: 'Slug is required' }, { status: 400 })
  }

  const sanitized = sanitizeSlug(slug)
  const validation = validateSlug(sanitized)

  if (!validation.valid) {
    return NextResponse.json({ available: false, error: validation.error })
  }

  const db = await getDb()
  const { rows } = await db.query(
    'SELECT id FROM organizations WHERE slug = $1', [sanitized]
  )

  if (rows.length > 0) {
    // Suggest alternative by appending a number
    let suggestion = sanitized
    for (let i = 2; i <= 10; i++) {
      const candidate = `${sanitized}-${i}`
      const { rows: check } = await db.query(
        'SELECT id FROM organizations WHERE slug = $1', [candidate]
      )
      if (check.length === 0) {
        suggestion = candidate
        break
      }
    }
    return NextResponse.json({ available: false, suggestion })
  }

  return NextResponse.json({ available: true, slug: sanitized })
}
