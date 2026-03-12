import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { recalcPetitionerStats, computeWeightedValidity } from '@/lib/petition-utils'
import { matchPeopleToVoterDb, matchPeopleToVoterFile } from '@/lib/matching'
import { getDatasetForCampaign } from '@/lib/voter-db'
import { getCampaignConfig } from '@/lib/campaign-config.server'
import { getVoterFile, NoVoterDataError } from '@/lib/mock-data'
import type { PersonEntry } from '@/types'

const PETITION_MATCH_OPTIONS = {
  lowCutoff: 0.40,
  mediumConfidenceThreshold: 0.60,
}

/**
 * POST: Re-run algorithmic matching for a single signature.
 * Resets user_confirmed and re-matches against the voter file.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; sigId: string }> },
) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { sheetId, sigId } = await params

    // Verify sheet
    const { rows: sheetRows } = await db.query(
      'SELECT id, petitioner_id FROM petition_sheets WHERE id = $1 AND campaign_id = $2',
      [sheetId, ctx.campaignId],
    )
    if (sheetRows.length === 0) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })
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

    // Build PersonEntry for matching
    const person: PersonEntry = {
      id: sig.id,
      firstName: sig.first_name,
      lastName: sig.last_name,
      address: sig.address || undefined,
      city: sig.city || undefined,
      zip: sig.zip || undefined,
      category: 'who-did-we-miss' as const,
    }

    // Run matching
    const assignment = await getDatasetForCampaign(ctx.campaignId)
    let results
    if (assignment) {
      results = await matchPeopleToVoterDb([person], assignment.datasetId, PETITION_MATCH_OPTIONS, assignment.filters)
    } else {
      const campaignConfig = await getCampaignConfig(ctx.campaignId)
      const state = campaignConfig.state || 'NC'
      const voterFile = await getVoterFile(state, campaignConfig.voterFile)
      results = await matchPeopleToVoterFile([person], voterFile, PETITION_MATCH_OPTIONS)
    }

    const result = results[0]
    if (!result) {
      return NextResponse.json({ error: 'Matching returned no result' }, { status: 500 })
    }

    // Determine new status
    const topCandidate = result.candidates[0]
    const score = topCandidate?.score || 0
    let matchStatus: string
    let matchData: string | null = null
    let matchScore: number | null = null
    let candidatesData: string | null = null

    if (result.candidates.length > 0) {
      candidatesData = JSON.stringify(result.candidates.map(c => ({
        voterRecord: c.voterRecord,
        score: c.score,
        confidenceLevel: c.confidenceLevel,
        matchedOn: c.matchedOn,
      })))
    }

    if (score >= 0.70) {
      matchStatus = 'matched'
      matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
      matchScore = score
    } else if (score >= 0.40) {
      matchStatus = 'ambiguous'
      matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
      matchScore = score
    } else {
      matchStatus = 'unmatched'
      if (result.bestMatch) {
        matchData = JSON.stringify(result.bestMatch)
        matchScore = score
      }
    }

    // Update signature — reset user_confirmed
    await db.query(`
      UPDATE petition_signatures
      SET match_status = $1, match_data = $2, match_score = $3, candidates_data = $4,
          user_confirmed = false, confirmed_by = NULL
      WHERE id = $5
    `, [matchStatus, matchData, matchScore, candidatesData, sigId])

    // Recalculate sheet stats
    const { rows: sheetSigs } = await db.query(
      'SELECT match_status, match_score, user_confirmed FROM petition_signatures WHERE sheet_id = $1',
      [sheetId],
    )
    const { validityRate, matchedCount } = computeWeightedValidity(sheetSigs)
    await db.query(
      'UPDATE petition_sheets SET matched_count = $1, validity_rate = $2 WHERE id = $3',
      [matchedCount, validityRate, sheetId],
    )

    // Recalculate petitioner stats if linked
    const petitionerId = sheetRows[0].petitioner_id
    if (petitionerId) {
      await recalcPetitionerStats(db, petitionerId)
    }

    await logActivity(ctx.userId, 'petition_signature_rematched', {
      sheetId, sigId, newStatus: matchStatus, newScore: matchScore,
    }, ctx.campaignId)

    return NextResponse.json({
      success: true,
      matchStatus,
      matchScore,
      candidateCount: result.candidates.length,
    })
  } catch (error: unknown) {
    if (error instanceof NoVoterDataError) {
      return NextResponse.json({ error: 'No voter data configured for this campaign.' }, { status: 422 })
    }
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * PATCH: Override a signature's match selection.
 * - candidateIndex: select a specific candidate from candidates_data
 * - matchStatus: 'matched' to force-confirm the current/specified candidate
 * - matchStatus: 'unmatched' to manually mark as no match
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; sigId: string }> },
) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { sheetId, sigId } = await params

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

      if (body.matchStatus === 'matched') {
        // Force-confirm as matched
        const candidateIdx = body.candidateIndex ?? 0
        let candidates: Array<{
          voterRecord: Record<string, unknown>
          score: number
          confidenceLevel: string
          matchedOn: string[]
        }> = []

        try {
          candidates = sig.candidates_data ? JSON.parse(sig.candidates_data) : []
        } catch {
          // No candidates to parse
        }

        if (candidates.length > 0 && candidateIdx >= 0 && candidateIdx < candidates.length) {
          const selected = candidates[candidateIdx]
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
        } else if (sig.match_data) {
          // No candidates but has existing match_data — confirm it
          await client.query(`
            UPDATE petition_signatures
            SET match_status = 'matched', user_confirmed = true, confirmed_by = $1
            WHERE id = $2
          `, [ctx.userId, sigId])
        } else {
          return NextResponse.json({ error: 'No match data to confirm' }, { status: 400 })
        }
      } else if (body.matchStatus === 'unmatched') {
        // Mark as manually unmatched
        await client.query(`
          UPDATE petition_signatures
          SET match_status = 'unmatched', match_data = NULL, match_score = NULL,
              user_confirmed = true, confirmed_by = $1
          WHERE id = $2
        `, [ctx.userId, sigId])
      } else if (typeof body.candidateIndex === 'number') {
        // Select a specific candidate (swap)
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

      // Recalculate sheet stats using weighted validity
      const { rows: sheetSigs } = await client.query(
        `SELECT match_status, match_score, user_confirmed FROM petition_signatures WHERE sheet_id = $1`,
        [sheetId],
      )
      const { validityRate, matchedCount } = computeWeightedValidity(sheetSigs)

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
      action: body.matchStatus === 'matched' ? 'confirm_match'
        : body.matchStatus === 'unmatched' ? 'mark_unmatched'
        : `select_candidate_${body.candidateIndex}`,
    }, ctx.campaignId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
