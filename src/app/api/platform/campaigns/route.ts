import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const { rows: relationalCampaigns } = await db.query(`
      SELECT c.id, c.name, c.slug, c.is_active, o.name as org_name, o.id as org_id
      FROM campaigns c
      JOIN organizations o ON o.id = c.org_id
      ORDER BY c.name
    `)

    const { rows: textingCampaigns } = await db.query(`
      SELECT tc.id, tc.title, tc.status, o.name as org_name, o.id as org_id
      FROM text_campaigns tc
      JOIN organizations o ON o.id = tc.organization_id
      ORDER BY tc.title
    `)

    return NextResponse.json({ relationalCampaigns, textingCampaigns })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
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

export async function PATCH(request: NextRequest) {
  try {
    await requirePlatformAdmin()
    const body = await request.json()
    const { id, name, type } = body

    if (!id || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 })
    }

    const db = await getDb()

    if (type === 'texting') {
      const { rows } = await db.query(
        'UPDATE text_campaigns SET title = $1 WHERE id = $2 RETURNING id, title',
        [name.trim(), id]
      )
      if (!rows[0]) return NextResponse.json({ error: 'Texting campaign not found' }, { status: 404 })
      return NextResponse.json({ campaign: rows[0] })
    }

    // Default: relational campaign
    const { rows } = await db.query(
      'UPDATE campaigns SET name = $1 WHERE id = $2 RETURNING id, name, slug',
      [name.trim(), id]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    return NextResponse.json({ campaign: rows[0] })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
