import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import type { AICampaignContext, CampaignType, GoalPriority } from '@/types'

export async function GET() {
  try {
    const ctx = await getRequestContext()
    const db = await getDb()

    const { rows } = await db.query(
      'SELECT settings FROM campaigns WHERE id = $1',
      [ctx.campaignId],
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const settings = (rows[0].settings || {}) as Record<string, unknown>
    const aiContext = (settings.aiContext || {}) as AICampaignContext

    return NextResponse.json({ aiContext })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/ai-context GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getRequestContext()

    // Admin-only
    if (ctx.role !== 'campaign_admin' && ctx.role !== 'org_owner' && ctx.role !== 'platform_admin' && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    let body: { aiContext: AICampaignContext }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.aiContext || typeof body.aiContext !== 'object') {
      return NextResponse.json({ error: 'aiContext object is required' }, { status: 400 })
    }

    // Sanitize inputs
    const sanitize = (val: unknown, maxLen = 5000): string | undefined =>
      typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) || undefined : undefined

    const validCampaignTypes: CampaignType[] = ['candidate', 'ballot-measure', 'issue-advocacy']
    const validGoalPriorities: GoalPriority[] = ['volunteer-recruitment', 'voter-turnout', 'persuasion', 'fundraising']

    const bc = body.aiContext as Record<string, unknown>

    const aiContext: AICampaignContext = {
      goals: sanitize(bc.goals),
      keyIssues: Array.isArray(bc.keyIssues)
        ? bc.keyIssues.filter((i): i is string => typeof i === 'string').map(i => i.slice(0, 200)).slice(0, 20)
        : undefined,
      talkingPoints: Array.isArray(bc.talkingPoints)
        ? bc.talkingPoints.filter((i): i is string => typeof i === 'string').map(i => i.slice(0, 500)).slice(0, 20)
        : undefined,
      messagingGuidance: sanitize(bc.messagingGuidance),
      campaignType: validCampaignTypes.includes(bc.campaignType as CampaignType)
        ? bc.campaignType as CampaignType
        : undefined,
      goalPriorities: Array.isArray(bc.goalPriorities)
        ? (bc.goalPriorities as string[]).filter((g): g is GoalPriority => validGoalPriorities.includes(g as GoalPriority)).slice(0, 4)
        : undefined,
      candidateInfo: bc.candidateInfo && typeof bc.candidateInfo === 'object'
        ? {
            name: sanitize((bc.candidateInfo as Record<string, unknown>).name, 200),
            party: sanitize((bc.candidateInfo as Record<string, unknown>).party, 50),
            office: sanitize((bc.candidateInfo as Record<string, unknown>).office, 200),
          }
        : undefined,
      electionInfo: bc.electionInfo && typeof bc.electionInfo === 'object'
        ? {
            date: sanitize((bc.electionInfo as Record<string, unknown>).date, 20),
            state: sanitize((bc.electionInfo as Record<string, unknown>).state, 5),
            district: sanitize((bc.electionInfo as Record<string, unknown>).district, 100),
          }
        : undefined,
      partyStrategies: bc.partyStrategies && typeof bc.partyStrategies === 'object'
        ? {
            DEM: sanitize((bc.partyStrategies as Record<string, unknown>).DEM, 500),
            REP: sanitize((bc.partyStrategies as Record<string, unknown>).REP, 500),
            UNF: sanitize((bc.partyStrategies as Record<string, unknown>).UNF, 500),
            OTHER: sanitize((bc.partyStrategies as Record<string, unknown>).OTHER, 500),
          }
        : undefined,
      customSurveyQuestions: Array.isArray(bc.customSurveyQuestions)
        ? (bc.customSurveyQuestions as Record<string, unknown>[]).slice(0, 10).map(q => ({
            id: sanitize(q.id, 50) || crypto.randomUUID(),
            question: sanitize(q.question, 500) || '',
            type: q.type === 'select' ? 'select' as const : 'text' as const,
            options: Array.isArray(q.options)
              ? (q.options as unknown[]).filter((o): o is string => typeof o === 'string').slice(0, 10)
              : undefined,
          }))
        : undefined,
    }

    const db = await getDb()

    // Merge into existing settings JSONB
    await db.query(
      `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ aiContext }), ctx.campaignId],
    )

    return NextResponse.json({ success: true, aiContext })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/ai-context PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
