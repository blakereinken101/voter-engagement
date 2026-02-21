import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { contactId: string } }) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { contactId } = params
    const body = await request.json()
    const { action, voterRecord, voteScore, segment, candidates } = body

    const db = getDb()

    // Verify ownership
    const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?').get(contactId, session.userId)
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    if (action === 'confirm' && voterRecord) {
      db.prepare(`
        UPDATE match_results SET
          status = 'confirmed',
          best_match_data = ?,
          candidates_data = ?,
          vote_score = ?,
          segment = ?,
          user_confirmed = 1,
          updated_at = datetime('now')
        WHERE contact_id = ?
      `).run(
        JSON.stringify(voterRecord),
        candidates ? JSON.stringify(candidates) : null,
        voteScore ?? null,
        segment ?? null,
        contactId
      )

      logActivity(db, session.userId, 'confirm_match', { contactId })
    } else if (action === 'reject') {
      db.prepare(`
        UPDATE match_results SET
          status = 'unmatched',
          best_match_data = NULL,
          vote_score = NULL,
          segment = NULL,
          user_confirmed = 0,
          updated_at = datetime('now')
        WHERE contact_id = ?
      `).run(contactId)

      logActivity(db, session.userId, 'reject_match', { contactId })
    } else if (action === 'set_results') {
      // Bulk set match results from the matching API
      db.prepare(`
        UPDATE match_results SET
          status = ?,
          best_match_data = ?,
          candidates_data = ?,
          vote_score = ?,
          segment = ?,
          user_confirmed = ?,
          updated_at = datetime('now')
        WHERE contact_id = ?
      `).run(
        body.status || 'pending',
        body.bestMatch ? JSON.stringify(body.bestMatch) : null,
        candidates ? JSON.stringify(candidates) : null,
        voteScore ?? null,
        segment ?? null,
        body.userConfirmed ? 1 : 0,
        contactId
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contacts/match PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
