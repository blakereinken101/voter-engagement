import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { contactId: string } }) {
  try {
    const ctx = await getRequestContext()

    const { contactId } = params
    const body = await request.json()
    const { action, voterRecord, voteScore, segment, candidates } = body

    const db = await getDb()

    // Verify ownership + campaign
    const { rows } = await db.query('SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND campaign_id = $3', [contactId, ctx.userId, ctx.campaignId])
    if (!rows[0]) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    if (action === 'confirm' && voterRecord) {
      await db.query(`
        UPDATE match_results SET
          status = 'confirmed',
          best_match_data = $1,
          candidates_data = $2,
          vote_score = $3,
          segment = $4,
          user_confirmed = 1,
          updated_at = NOW()
        WHERE contact_id = $5
      `, [
        JSON.stringify(voterRecord),
        candidates ? JSON.stringify(candidates) : null,
        voteScore ?? null,
        segment ?? null,
        contactId
      ])

      await logActivity(ctx.userId, 'confirm_match', { contactId }, ctx.campaignId)
    } else if (action === 'reject') {
      await db.query(`
        UPDATE match_results SET
          status = 'unmatched',
          best_match_data = NULL,
          vote_score = NULL,
          segment = NULL,
          user_confirmed = 0,
          updated_at = NOW()
        WHERE contact_id = $1
      `, [contactId])

      await logActivity(ctx.userId, 'reject_match', { contactId }, ctx.campaignId)
    } else if (action === 'set_results') {
      // Bulk set match results from the matching API
      await db.query(`
        UPDATE match_results SET
          status = $1,
          best_match_data = $2,
          candidates_data = $3,
          vote_score = $4,
          segment = $5,
          user_confirmed = $6,
          updated_at = NOW()
        WHERE contact_id = $7
      `, [
        body.status || 'pending',
        body.bestMatch ? JSON.stringify(body.bestMatch) : null,
        candidates ? JSON.stringify(candidates) : null,
        voteScore ?? null,
        segment ?? null,
        body.userConfirmed ? 1 : 0,
        contactId
      ])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[contacts/match PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
