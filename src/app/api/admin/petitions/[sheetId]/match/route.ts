import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { matchPeopleToVoterDb, matchPeopleToVoterFile } from '@/lib/matching'
import { getDatasetForCampaign } from '@/lib/voter-db'
import { getCampaignConfig } from '@/lib/campaign-config.server'
import { getVoterFile, NoVoterDataError } from '@/lib/mock-data'
import { recalcPetitionerStats } from '@/lib/petition-utils'
import { aiRerankMatches, applyAiReranking } from '@/lib/ai-rerank'
import { isAIEnabled } from '@/lib/ai-chat'
import { getAISettings } from '@/lib/ai-settings'
import type { PersonEntry, MatchResult } from '@/types'
import type { AiRerankInput } from '@/lib/ai-rerank'

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
    const people: PersonEntry[] = signatures.map((sig) => ({
      id: sig.id,
      firstName: sig.first_name,
      lastName: sig.last_name,
      address: sig.address || undefined,
      city: sig.city || undefined,
      zip: sig.zip || undefined,
      category: 'who-did-we-miss' as const,
    }))

    // Run algorithmic matching
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

    // AI re-ranking: send candidates to LLM for holistic evaluation
    if (isAIEnabled()) {
      try {
        const aiSettings = await getAISettings()

        const rerankInputs: AiRerankInput[] = results
          .filter(r => r.candidates.length > 0)
          .map(r => ({
            signatureId: r.personEntry.id,
            ocrData: {
              firstName: r.personEntry.firstName,
              lastName: r.personEntry.lastName,
              address: r.personEntry.address,
              city: r.personEntry.city,
              zip: r.personEntry.zip,
            },
            candidates: r.candidates.map((c, idx) => ({
              index: idx,
              firstName: c.voterRecord.first_name,
              lastName: c.voterRecord.last_name,
              address: c.voterRecord.residential_address,
              city: c.voterRecord.city,
              zip: c.voterRecord.zip,
              party: c.voterRecord.party_affiliation,
              algorithmicScore: c.score,
            })),
          }))

        if (rerankInputs.length > 0) {
          const aiResults = await aiRerankMatches(
            rerankInputs,
            aiSettings.provider,
            aiSettings.suggestModel,
          )
          applyAiReranking(results, aiResults)
        }
      } catch (err) {
        console.error('[petition-match] AI re-ranking failed (falling back to algorithmic):', err)
      }
    }

    // Compute match results for all signatures, then batch-update in one query
    let matchedCount = 0
    const ids: string[] = []
    const statuses: string[] = []
    const matchDatas: (string | null)[] = []
    const matchScores: (number | null)[] = []
    const candidatesDatas: (string | null)[] = []

    for (const result of results) {
      const sigId = result.personEntry.id
      let matchStatus: string
      let matchData: string | null = null
      let matchScore: number | null = null
      let candidatesData: string | null = null

      // Store all candidates for side-by-side comparison (including AI fields)
      if (result.candidates.length > 0) {
        candidatesData = JSON.stringify(result.candidates.map(c => ({
          voterRecord: c.voterRecord,
          score: c.score,
          confidenceLevel: c.confidenceLevel,
          matchedOn: c.matchedOn,
          ...(c.aiConfidence ? { aiConfidence: c.aiConfidence } : {}),
          ...(c.aiReasoning ? { aiReasoning: c.aiReasoning } : {}),
        })))
      }

      // Determine match status using algorithmic score + AI confidence
      const topCandidate = result.candidates[0]
      const score = topCandidate?.score || 0
      const aiConf = topCandidate?.aiConfidence // undefined if AI didn't run

      if (result.status === 'confirmed' || score >= 0.70) {
        if (aiConf === 'unlikely-match') {
          matchStatus = 'ambiguous'
        } else {
          matchStatus = 'matched'
        }
        matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
        matchScore = score || null
        matchedCount++
      } else if (score >= 0.55) {
        if (aiConf === 'likely-match') {
          matchStatus = 'matched'
        } else if (aiConf === 'unlikely-match') {
          matchStatus = 'unmatched'
        } else {
          matchStatus = 'ambiguous'
        }
        matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
        matchScore = score || null
        if (matchStatus !== 'unmatched') matchedCount++
      } else if (aiConf === 'likely-match') {
        matchStatus = 'ambiguous'
        matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
        matchScore = score || null
        matchedCount++
      } else {
        matchStatus = 'unmatched'
        if (result.bestMatch) {
          matchData = JSON.stringify(result.bestMatch)
          matchScore = score || null
        }
      }

      ids.push(sigId)
      statuses.push(matchStatus)
      matchDatas.push(matchData)
      matchScores.push(matchScore)
      candidatesDatas.push(candidatesData)
    }

    // Batch update all signatures + sheet stats in a single transaction (2 queries instead of N+1)
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      if (ids.length > 0) {
        await client.query(`
          UPDATE petition_signatures AS ps SET
            match_status = bulk.match_status,
            match_data = bulk.match_data::jsonb,
            match_score = bulk.match_score,
            candidates_data = bulk.candidates_data::jsonb
          FROM (
            SELECT
              unnest($1::uuid[]) AS id,
              unnest($2::text[]) AS match_status,
              unnest($3::text[]) AS match_data,
              unnest($4::double precision[]) AS match_score,
              unnest($5::text[]) AS candidates_data
          ) AS bulk
          WHERE ps.id = bulk.id
        `, [ids, statuses, matchDatas, matchScores, candidatesDatas])
      }

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

    // Recalculate petitioner stats if this sheet is linked to a petitioner
    const { rows: sheetData } = await db.query(
      'SELECT petitioner_id FROM petition_sheets WHERE id = $1',
      [sheetId],
    )
    if (sheetData[0]?.petitioner_id) {
      await recalcPetitionerStats(db, sheetData[0].petitioner_id)
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
    if (error instanceof NoVoterDataError) {
      console.error('[petition-match]', error.message)
      return NextResponse.json({
        error: 'No voter data configured for this campaign. An admin needs to upload a voter dataset in the platform admin.',
        code: error.code,
      }, { status: 422 })
    }
    // Log the full error so matching failures are diagnosable in server logs
    console.error('[petition-match] Matching failed for sheet:', request.url, error)
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
