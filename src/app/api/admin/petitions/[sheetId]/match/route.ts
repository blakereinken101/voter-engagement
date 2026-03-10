import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { matchPeopleToVoterDb, matchPeopleToVoterFile } from '@/lib/matching'
import { getDatasetForCampaign } from '@/lib/voter-db'
import { getCampaignConfig } from '@/lib/campaign-config.server'
import { getVoterFile, NoVoterDataError } from '@/lib/mock-data'
import { recalcPetitionerStats, computeWeightedValidity } from '@/lib/petition-utils'
import { aiRerankMatches, applyAiReranking } from '@/lib/ai-rerank'
import { isAIEnabled } from '@/lib/ai-chat'
import { getAISettings } from '@/lib/ai-settings'
import type { PersonEntry, MatchResult } from '@/types'
import type { AiRerankInput } from '@/lib/ai-rerank'

// Petition matching uses lower thresholds than the chat flow because
// OCR'd handwritten signatures are noisier than volunteer-typed names.
const PETITION_MATCH_OPTIONS = {
  lowCutoff: 0.40,
  mediumConfidenceThreshold: 0.60,
}

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

    // Run algorithmic matching with petition-specific lower thresholds
    const assignment = await getDatasetForCampaign(ctx.campaignId)
    let results: MatchResult[]
    if (assignment) {
      results = await matchPeopleToVoterDb(people, assignment.datasetId, PETITION_MATCH_OPTIONS, assignment.filters)
    } else {
      const campaignConfig = await getCampaignConfig(ctx.campaignId)
      const state = campaignConfig.state || 'NC'
      const voterFile = await getVoterFile(state, campaignConfig.voterFile)
      results = await matchPeopleToVoterFile(people, voterFile, PETITION_MATCH_OPTIONS)
    }

    // Diagnostic logging — understand what matching actually returned
    const withCandidates = results.filter(r => r.candidates.length > 0).length
    const zeroCandidates = results.length - withCandidates
    const scores = results.map(r => r.candidates[0]?.score || 0).filter(s => s > 0)
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3) : 'N/A'
    const above70 = scores.filter(s => s >= 0.70).length
    const above55 = scores.filter(s => s >= 0.55).length
    const above40 = scores.filter(s => s >= 0.40).length
    console.log(`[petition-match] Sheet ${sheetId}: ${results.length} sigs, ${withCandidates} with candidates, ${zeroCandidates} with zero candidates. Scores: avg=${avgScore}, >=0.70: ${above70}, >=0.55: ${above55}, >=0.40: ${above40}`)

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
          console.log(`[petition-match] AI re-ranking: ${aiResults.length} assessments returned for ${rerankInputs.length} inputs`)
        }
      } catch (err) {
        console.error('[petition-match] AI re-ranking failed (falling back to algorithmic):', err)
      }
    }

    // Update each signature with match results.
    // Uses per-row updates for reliability (batch unnest had null-handling issues).
    const client = await db.connect()

    // Collect signature statuses for weighted validity calculation
    const sigStatuses: { match_status: string; match_score: number | null; user_confirmed: boolean }[] = []
    let matchedCount = 0
    let validityRate = 0

    try {
      await client.query('BEGIN')

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

        // Determine match status.
        // For petitions, AI confidence informs the admin but does NOT veto.
        // Anything with score >= 0.40 (petition lowCutoff) gets surfaced for review.
        const topCandidate = result.candidates[0]
        const score = topCandidate?.score || 0

        if (result.status === 'confirmed' || score >= 0.70) {
          matchStatus = 'matched'
          matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
          matchScore = score || null
        } else if (score >= 0.40) {
          matchStatus = 'ambiguous'
          matchData = result.bestMatch ? JSON.stringify(result.bestMatch) : null
          matchScore = score || null
        } else {
          matchStatus = 'unmatched'
          // Still store best match data for "best guess" display
          if (result.bestMatch) {
            matchData = JSON.stringify(result.bestMatch)
            matchScore = score || null
          }
        }

        sigStatuses.push({ match_status: matchStatus, match_score: matchScore, user_confirmed: false })

        await client.query(`
          UPDATE petition_signatures
          SET match_status = $1, match_data = $2, match_score = $3, candidates_data = $4
          WHERE id = $5
        `, [matchStatus, matchData, matchScore, candidatesData, sigId])
      }

      // Weighted validity: confirmed decisions count as 1/0, unconfirmed use match score
      const weighted = computeWeightedValidity(sigStatuses)
      matchedCount = weighted.matchedCount
      validityRate = weighted.validityRate

      await client.query(`
        UPDATE petition_sheets
        SET matched_count = $1, validity_rate = $2, status = 'matched'
        WHERE id = $3
      `, [matchedCount, validityRate, sheetId])

      await client.query('COMMIT')

      console.log(`[petition-match] Sheet ${sheetId}: matchedCount=${matchedCount}, validityRate=${validityRate}%`)
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
      validityRate,
    }, ctx.campaignId)

    return NextResponse.json({
      success: true,
      totalSignatures: signatures.length,
      matchedCount,
      validityRate,
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
