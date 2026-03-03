import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { invalidateConfigCache } from '@/lib/campaign-config.server'
import { PROMPT_SECTIONS } from '@/lib/ai-prompts'
import type { AICampaignContext, CampaignType, GoalPriority } from '@/types'

// Sanitize a string value: strip HTML tags, trim, and limit length
const sanitize = (val: unknown, maxLen = 5000): string | undefined =>
  typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) || undefined : undefined

const validCampaignTypes: CampaignType[] = ['candidate', 'ballot-measure', 'issue-advocacy']
const validGoalPriorities: GoalPriority[] = ['volunteer-recruitment', 'voter-turnout', 'persuasion', 'fundraising']

/**
 * Sanitize a raw AI context object into a safe AICampaignContext.
 * Reused for both aiContext and platformOverrides.
 */
function sanitizeAIContext(raw: Record<string, unknown>): AICampaignContext {
  const fc = raw.fundraisingConfig as Record<string, unknown> | undefined

  return {
    goals: sanitize(raw.goals),
    keyIssues: Array.isArray(raw.keyIssues)
      ? raw.keyIssues.filter((i): i is string => typeof i === 'string').map(i => i.slice(0, 200)).slice(0, 20)
      : undefined,
    talkingPoints: Array.isArray(raw.talkingPoints)
      ? raw.talkingPoints.filter((i): i is string => typeof i === 'string').map(i => i.slice(0, 500)).slice(0, 20)
      : undefined,
    messagingGuidance: sanitize(raw.messagingGuidance),
    campaignType: validCampaignTypes.includes(raw.campaignType as CampaignType)
      ? raw.campaignType as CampaignType
      : undefined,
    goalPriorities: Array.isArray(raw.goalPriorities)
      ? (raw.goalPriorities as string[]).filter((g): g is GoalPriority => validGoalPriorities.includes(g as GoalPriority)).slice(0, 4)
      : undefined,
    candidateInfo: raw.candidateInfo && typeof raw.candidateInfo === 'object'
      ? {
          name: sanitize((raw.candidateInfo as Record<string, unknown>).name, 200),
          party: sanitize((raw.candidateInfo as Record<string, unknown>).party, 50),
          office: sanitize((raw.candidateInfo as Record<string, unknown>).office, 200),
        }
      : undefined,
    electionInfo: raw.electionInfo && typeof raw.electionInfo === 'object'
      ? {
          date: sanitize((raw.electionInfo as Record<string, unknown>).date, 20),
          state: sanitize((raw.electionInfo as Record<string, unknown>).state, 5),
          district: sanitize((raw.electionInfo as Record<string, unknown>).district, 100),
        }
      : undefined,
    partyStrategies: raw.partyStrategies && typeof raw.partyStrategies === 'object'
      ? {
          DEM: sanitize((raw.partyStrategies as Record<string, unknown>).DEM, 500),
          REP: sanitize((raw.partyStrategies as Record<string, unknown>).REP, 500),
          UNF: sanitize((raw.partyStrategies as Record<string, unknown>).UNF, 500),
          OTHER: sanitize((raw.partyStrategies as Record<string, unknown>).OTHER, 500),
        }
      : undefined,
    customSurveyQuestions: Array.isArray(raw.customSurveyQuestions)
      ? (raw.customSurveyQuestions as Record<string, unknown>[]).slice(0, 10).map(q => ({
          id: sanitize(q.id, 50) || crypto.randomUUID(),
          question: sanitize(q.question, 500) || '',
          type: q.type === 'select' ? 'select' as const : 'text' as const,
          options: Array.isArray(q.options)
            ? (q.options as unknown[]).filter((o): o is string => typeof o === 'string').slice(0, 10)
            : undefined,
        }))
      : undefined,
    fundraisingConfig: fc && typeof fc === 'object'
      ? {
          requireResidency: fc.requireResidency === true,
          contributionLimits: sanitize(fc.contributionLimits, 1000),
          fundraisingGuidance: sanitize(fc.fundraisingGuidance, 5000),
          fundraiserTypes: Array.isArray(fc.fundraiserTypes)
            ? (fc.fundraiserTypes as Record<string, unknown>[])
                .slice(0, 20)
                .map(ft => ({
                  id: sanitize(ft.id, 50) || crypto.randomUUID(),
                  name: sanitize(ft.name, 100) || '',
                  guidance: sanitize(ft.guidance, 5000) || '',
                }))
                .filter(ft => ft.name)
            : undefined,
        }
      : undefined,
    targetUniverse: raw.targetUniverse && typeof raw.targetUniverse === 'object'
      ? (() => {
          const tu = raw.targetUniverse as Record<string, unknown>
          const validFields = ['VH2024G', 'VH2022G', 'VH2020G', 'VH2024P', 'VH2022P', 'VH2020P']
          const validValues = ['voted', 'did-not-vote']
          const result: Record<string, string> = {}
          for (const field of validFields) {
            if (typeof tu[field] === 'string' && validValues.includes(tu[field] as string)) {
              result[field] = tu[field] as string
            }
          }
          return Object.keys(result).length > 0 ? result : undefined
        })()
      : undefined,
    // Per-campaign prompt overrides — only valid chat section IDs, not event_suggest
    promptOverrides: raw.promptOverrides && typeof raw.promptOverrides === 'object'
      ? (() => {
          const po = raw.promptOverrides as Record<string, unknown>
          const chatSections = PROMPT_SECTIONS.filter(s => s !== 'event_suggest')
          const result: Record<string, string> = {}
          for (const key of chatSections) {
            const val = sanitize(po[key], 10000)
            if (val) result[key] = val
          }
          return Object.keys(result).length > 0 ? result : undefined
        })()
      : undefined,
  }
}

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

    // Only return platformOverrides to platform admins
    const platformOverrides = ctx.isPlatformAdmin
      ? (settings.platformOverrides as AICampaignContext) || {}
      : undefined

    return NextResponse.json({ aiContext, ...(platformOverrides !== undefined ? { platformOverrides } : {}) })
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

    let body: { aiContext?: AICampaignContext; platformOverrides?: AICampaignContext }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const db = await getDb()

    // Save aiContext (any admin)
    if (body.aiContext && typeof body.aiContext === 'object') {
      const aiContext = sanitizeAIContext(body.aiContext as Record<string, unknown>)
      await db.query(
        `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ aiContext }), ctx.campaignId],
      )
    }

    // Save platformOverrides (platform admin only)
    if (body.platformOverrides !== undefined && ctx.isPlatformAdmin) {
      const platformOverrides = body.platformOverrides && typeof body.platformOverrides === 'object'
        ? sanitizeAIContext(body.platformOverrides as Record<string, unknown>)
        : {}
      await db.query(
        `UPDATE campaigns SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ platformOverrides }), ctx.campaignId],
      )
    }

    // Invalidate cached config so next chat picks up changes immediately
    invalidateConfigCache(ctx.campaignId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/ai-context PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
