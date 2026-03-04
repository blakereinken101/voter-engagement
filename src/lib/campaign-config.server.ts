import { getPool } from './db'
import campaignConfig, { type CampaignConfig, type SurveyQuestionConfig } from './campaign-config'
import type { AICampaignContext } from '@/types'

// Cache campaign config for 60 seconds to avoid hitting DB on every chat message
const configCache = new Map<string, { config: CampaignConfig; timestamp: number }>()
const CONFIG_CACHE_TTL = 60_000

export function invalidateConfigCache(campaignId?: string) {
  if (campaignId) {
    configCache.delete(campaignId)
  } else {
    configCache.clear()
  }
}

/**
 * Load campaign config from the database by campaign ID.
 * Server-only — imports pg which requires Node.js modules.
 * Falls back to the env-var-based default if the campaign is not found.
 *
 * Platform admin overrides (stored in campaigns.settings.platformOverrides)
 * are merged on top of aiContext so they take precedence.
 *
 * Results are cached for 60 seconds to avoid redundant DB queries.
 */
export async function getCampaignConfig(campaignId: string): Promise<CampaignConfig> {
  const now = Date.now()
  const cached = configCache.get(campaignId)
  if (cached && now - cached.timestamp < CONFIG_CACHE_TTL) {
    return cached.config
  }
  const pool = getPool()

  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.candidate_name, c.state, c.election_date, c.settings,
            o.name as org_name
     FROM campaigns c
     JOIN organizations o ON o.id = c.org_id
     WHERE c.id = $1`,
    [campaignId]
  )

  if (rows.length === 0) {
    return campaignConfig
  }

  const row = rows[0]
  const settings = (row.settings || {}) as Record<string, unknown>

  const aiContext = (settings.aiContext as AICampaignContext) || undefined
  const platformOverrides = (settings.platformOverrides as Partial<AICampaignContext>) || undefined

  // Merge platform admin overrides on top of campaign admin's aiContext
  let mergedAiContext = aiContext
  if (platformOverrides) {
    // Shallow merge: non-empty override fields replace base fields
    const overrideEntries = Object.entries(platformOverrides)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (overrideEntries.length > 0) {
      mergedAiContext = { ...(aiContext || {}), ...Object.fromEntries(overrideEntries) } as AICampaignContext

      // Deep merge fundraisingConfig (one level deeper)
      if (platformOverrides.fundraisingConfig && mergedAiContext) {
        const overrideFc = Object.entries(platformOverrides.fundraisingConfig)
          .filter(([, v]) => v !== undefined && v !== null)
        if (overrideFc.length > 0) {
          mergedAiContext.fundraisingConfig = {
            ...(aiContext?.fundraisingConfig || {}),
            ...Object.fromEntries(overrideFc),
          }
        }
      }

      // Deep merge promptOverrides (one level deeper)
      if (platformOverrides.promptOverrides && mergedAiContext) {
        const overridePo = Object.entries(platformOverrides.promptOverrides)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
        if (overridePo.length > 0) {
          mergedAiContext.promptOverrides = {
            ...(aiContext?.promptOverrides || {}),
            ...Object.fromEntries(overridePo),
          }
        }
      }
    }
  }

  const result: CampaignConfig = {
    id: row.id as string,
    name: row.name as string,
    candidateName: (row.candidate_name as string) || campaignConfig.candidateName,
    state: (row.state as string) || campaignConfig.state,
    electionDate: row.election_date ? new Date(row.election_date as string).toISOString().slice(0, 10) : campaignConfig.electionDate,
    organizationName: (row.org_name as string) || campaignConfig.organizationName,
    privacyText: (settings.privacyText as string) || campaignConfig.privacyText,
    voterFile: (settings.voterFile as string) || undefined,
    surveyQuestions: Array.isArray(settings.surveyQuestions) && (settings.surveyQuestions as SurveyQuestionConfig[]).length > 0
      ? (settings.surveyQuestions as SurveyQuestionConfig[])
      : campaignConfig.surveyQuestions,
    aiContext: mergedAiContext,
  }

  configCache.set(campaignId, { config: result, timestamp: Date.now() })
  return result
}
