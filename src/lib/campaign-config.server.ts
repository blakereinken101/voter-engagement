import { getPool } from './db'
import campaignConfig, { type CampaignConfig, type SurveyQuestionConfig } from './campaign-config'
import type { AICampaignContext } from '@/types'

/**
 * Load campaign config from the database by campaign ID.
 * Server-only — imports pg which requires Node.js modules.
 * Falls back to the env-var-based default if the campaign is not found.
 */
export async function getCampaignConfig(campaignId: string): Promise<CampaignConfig> {
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

  return {
    id: row.id as string,
    name: row.name as string,
    candidateName: (row.candidate_name as string) || campaignConfig.candidateName,
    state: (row.state as string) || campaignConfig.state,
    electionDate: row.election_date ? new Date(row.election_date as string).toISOString().slice(0, 10) : campaignConfig.electionDate,
    organizationName: (row.org_name as string) || campaignConfig.organizationName,
    privacyText: (settings.privacyText as string) || campaignConfig.privacyText,
    voterFile: (settings.voterFile as string) || undefined,
    surveyQuestions: (settings.surveyQuestions as SurveyQuestionConfig[]) || campaignConfig.surveyQuestions,
    aiContext: (settings.aiContext as AICampaignContext) || undefined,
  }
}
