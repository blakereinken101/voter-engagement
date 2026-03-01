import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { matchPeopleToVoterDb, matchPeopleToVoterFile } from '@/lib/matching'
import { getDatasetForCampaign } from '@/lib/voter-db'
import { getCampaignConfig } from '@/lib/campaign-config.server'
import { getVoterFile } from '@/lib/mock-data'
import type { PersonEntry, MatchResult } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { sheetId: string } },
) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { sheetId } = params

    // Verify sheet belongs to this campaign
    const { rows: sheetRows } = await db.query(
      'SELECT id, status FROM petition_sheets WHERE id = $1 AND campaign_id = $2',
      [sheetId, ctx.campaignId],
    )
    if (sheetRows.length === 0) {
      return NextResponse.json({ error: 'Petition sheet not found' }, { status: 404 })
    }

    // Load all signatures
    const { rows: signatures } = await db.query(
      'SELECT * FROM petition_signatures WHERE sheet_id = $1 ORDER BY line_number ASC NULLS LAST',
      [sheetId],
    )

    if (signatures.length === 0) {
      return NextResponse.json({ error: 'No signatures to match' }, { status: 400 })
    }

    // Convert signatures to PersonEntry format for matching
    const people: PersonEntry[] = signatures.map((sig, idx) => ({
      id: sig.id,
      firstName: sig.first_name,
      lastName: sig.last_name,
      address: sig.address || undefined,
      city: sig.city || undefined,
      zip: sig.zip || undefined,
      category: 'who-did-we-miss' as const,
    }))

    // Run matching using existing infrastructure
    const assignment = await getDatasetForCampaign(ctx.campaignId)
    let results: MatchResult[]
    if (assignment) {
      results = await matchPeopleToVoterDb(people, assignment.datasetId, {}, assignment.filters)
    } else {
      const campaignConfig = await getCampaignConfig(ctx.campaignId)
      const state = campaignConfig.state || 'NC'
      const voterFile = await getVoterFile(state, campaignConfig.voterFile)
      results = await matchPeopleToVoterFile(people, voterFile)
    }

    // Update each signature with match results
    const client = await db.connect()
    let matchedCount = 0

    try {
      await client.query('BEGIN')

      for (const result of results) {
        const sigId = result.personEntry.id
        let matchStatus: string
        let matchData: string | null = null
        let matchScore: number | null = null

        if (result.status === 'confirmed' || (result.bestMatch && result.candidates.length > 0 && result.candidates[0].score >= 0.70)) {
          matchStatus = 'matched'
          matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
          matchScore = result.candidates[0]?.score || null
          matchedCount++
        } else if (result.candidates.length > 0 && result.candidates[0].score >= 0.55) {
          matchStatus = 'ambiguous'
          matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
          matchScore = result.candidates[0]?.score || null
          // Count ambiguous as partial match for validity
          matchedCount++
        } else {
          matchStatus = 'unmatched'
        }

        await client.query(`
          UPDATE petition_signatures
          SET match_status = $1, match_data = $2, match_score = $3
          WHERE id = $4
        `, [matchStatus, matchData, matchScore, sigId])
      }

      // Update sheet stats
      const validityRate = signatures.length > 0
        ? Math.round((matchedCount / signatures.length) * 1000) / 10
        : 0

      await client.query(`
        UPDATE petition_sheets
        SET matched_count = $1, validity_rate = $2, status = 'matched'
        WHERE id = $3
      `, [matchedCount, validityRate, sheetId])

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await logActivity(ctx.userId, 'petition_sheet_matched', {
      sheetId,
      totalSignatures: signatures.length,
      matchedCount,
      validityRate: signatures.length > 0 ? Math.round((matchedCount / signatures.length) * 1000) / 10 : 0,
    }, ctx.campaignId)

    return NextResponse.json({
      success: true,
      totalSignatures: signatures.length,
      matchedCount,
      validityRate: signatures.length > 0 ? Math.round((matchedCount / signatures.length) * 1000) / 10 : 0,
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
