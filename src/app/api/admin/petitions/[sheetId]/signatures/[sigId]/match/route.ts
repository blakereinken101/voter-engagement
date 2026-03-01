import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { recalcPetitionerStats } from '@/lib/petition-utils'

/**
 * PATCH: Override a signature's match selection.
 * - candidateIndex: select a specific candidate from candidates_data
 * - matchStatus: 'unmatched' to manually mark as no match
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { sheetId: string; sigId: string } },
) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { sheetId, sigId } = params

    let body: { candidateIndex?: number; matchStatus?: 'matched' | 'unmatched' }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Verify sheet belongs to this campaign
    const { rows: sheetRows } = await db.query(
      'SELECT id, petitioner_id FROM petition_sheets WHERE id = $1 AND campaign_id = $2',
      [sheetId, ctx.campaignId],
    )
    if (sheetRows.length === 0) {
      return NextResponse.json({ error: 'Petition sheet not found' }, { status: 404 })
    }

    // Load the signature
    const { rows: sigRows } = await db.query(
      'SELECT * FROM petition_signatures WHERE id = $1 AND sheet_id = $2',
      [sigId, sheetId],
    )
    if (sigRows.length === 0) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 })
    }

    const sig = sigRows[0]
    const client = await db.connect()

    try {
      await client.query('BEGIN')

      if (body.matchStatus === 'unmatched') {
        // Mark as manually unmatched
        await client.query(`
          UPDATE petition_signatures
          SET match_status = 'unmatched', match_data = NULL, match_score = NULL,
              user_confirmed = true, confirmed_by = $1
          WHERE id = $2
        `, [ctx.userId, sigId])
      } else if (typeof body.candidateIndex === 'number') {
        // Select a specific candidate
        let candidates: Array<{
          voterRecord: Record<string, unknown>
          score: number
          confidenceLevel: string
          matchedOn: string[]
        }> = []

        try {
          candidates = sig.candidates_data ? JSON.parse(sig.candidates_data) : []
        } catch {
          return NextResponse.json({ error: 'No candidates data available' }, { status: 400 })
        }

        if (body.candidateIndex < 0 || body.candidateIndex >= candidates.length) {
          return NextResponse.json({ error: 'Invalid candidate index' }, { status: 400 })
        }

        const selected = candidates[body.candidateIndex]
        await client.query(`
          UPDATE petition_signatures
          SET match_status = 'matched', match_data = $1, match_score = $2,
              user_confirmed = true, confirmed_by = $3
          WHERE id = $4
        `, [
          JSON.stringify(selected.voterRecord),
          selected.score,
          ctx.userId,
          sigId,
        ])
      } else {
        return NextResponse.json({ error: 'Provide candidateIndex or matchStatus' }, { status: 400 })
      }

      // Recalculate sheet stats
      const { rows: sheetSigs } = await client.query(
        `SELECT match_status FROM petition_signatures WHERE sheet_id = $1`,
        [sheetId],
      )
      const totalSigs = sheetSigs.length
      const matchedCount = sheetSigs.filter(
        (s: { match_status: string }) => s.match_status === 'matched' || s.match_status === 'ambiguous'
      ).length
      const validityRate = totalSigs > 0
        ? Math.round((matchedCount / totalSigs) * 1000) / 10
        : 0

      await client.query(`
        UPDATE petition_sheets
        SET matched_count = $1, validity_rate = $2
        WHERE id = $3
      `, [matchedCount, validityRate, sheetId])

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // Recalculate petitioner stats if linked
    const petitionerId = sheetRows[0].petitioner_id
    if (petitionerId) {
      await recalcPetitionerStats(db, petitionerId)
    }

    await logActivity(ctx.userId, 'petition_signature_match_override', {
      sheetId,
      sigId,
      action: body.matchStatus === 'unmatched' ? 'mark_unmatched' : `select_candidate_${body.candidateIndex}`,
    }, ctx.campaignId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
