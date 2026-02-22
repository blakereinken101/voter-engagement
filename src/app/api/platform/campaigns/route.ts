import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, AuthError, handleAuthError } from '@/lib/auth'

async function requirePlatformAdmin() {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  const db = await getDb()
  const { rows } = await db.query('SELECT is_platform_admin FROM users WHERE id = $1', [session.userId])
  if (!rows[0] || !rows[0].is_platform_admin) {
    throw new AuthError('Platform admin access required', 403)
  }
  return session
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin()
    const body = await request.json()
    const { orgId, name, slug, candidateName, state, electionDate } = body

    if (!orgId || !name || !slug || !state) {
      return NextResponse.json({ error: 'orgId, name, slug, and state are required' }, { status: 400 })
    }

    const db = await getDb()

    // Verify org exists
    const { rows: orgRows } = await db.query('SELECT id FROM organizations WHERE id = $1', [orgId])
    if (!orgRows[0]) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    const id = crypto.randomUUID()
    const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50)

    await db.query(
      `INSERT INTO campaigns (id, org_id, name, slug, candidate_name, state, election_date, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, orgId, name.trim(), safeSlug, candidateName || null, state.toUpperCase(), electionDate || null, JSON.stringify({
        surveyQuestions: [
          { id: 'top_issue', label: 'Top issue', type: 'select', options: ['Economy', 'Healthcare', 'Education', 'Environment', 'Immigration', 'Housing', 'Crime/Safety', 'Other'] },
          { id: 'vote_plan', label: 'Plan to vote?', type: 'select', options: ['Yes - Election Day', 'Yes - Early voting', 'Yes - By mail', 'Maybe', 'No'] },
          { id: 'needs_ride', label: 'Needs ride to polls?', type: 'select', options: ['Yes', 'No', 'Maybe'] },
        ],
      })]
    )

    return NextResponse.json({ campaign: { id, orgId, name: name.trim(), slug: safeSlug, state: state.toUpperCase() } })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
