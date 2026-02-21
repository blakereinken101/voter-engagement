export interface SurveyQuestionConfig {
  id: string
  label: string
  type: 'select' | 'text'
  options?: string[]
}

export interface CampaignConfig {
  id: string
  name: string
  candidateName: string
  state: string
  electionDate?: string
  organizationName?: string
  privacyText?: string
  surveyQuestions: SurveyQuestionConfig[]
}

/**
 * Campaign configuration — reads from environment variables.
 * Set these in Railway Variables for each deployment:
 *
 *   CAMPAIGN_ID, NEXT_PUBLIC_CAMPAIGN_NAME, NEXT_PUBLIC_CANDIDATE_NAME,
 *   NEXT_PUBLIC_CAMPAIGN_STATE, NEXT_PUBLIC_ORGANIZATION_NAME, ELECTION_DATE
 *
 * Client-visible values use NEXT_PUBLIC_ prefix (Next.js requirement).
 * Server-only values (CAMPAIGN_ID, ELECTION_DATE) don't need the prefix.
 */
const campaignConfig: CampaignConfig = {
  id: process.env.CAMPAIGN_ID || process.env.NEXT_PUBLIC_CAMPAIGN_ID || 'demo-2026',
  name: process.env.NEXT_PUBLIC_CAMPAIGN_NAME || 'Threshold Demo',
  candidateName: process.env.NEXT_PUBLIC_CANDIDATE_NAME || 'Demo Candidate',
  state: process.env.NEXT_PUBLIC_CAMPAIGN_STATE || 'NC',
  electionDate: process.env.ELECTION_DATE || '2026-11-03',
  organizationName: process.env.NEXT_PUBLIC_ORGANIZATION_NAME || 'Threshold',
  privacyText: 'Your data stays on your device. Names you enter are only used to match against public voter records. Each campaign\'s data is isolated — your work here is private to this campaign.',
  surveyQuestions: [
    {
      id: 'top_issue',
      label: 'Top issue',
      type: 'select',
      options: ['Economy', 'Healthcare', 'Education', 'Environment', 'Immigration', 'Housing', 'Crime/Safety', 'Other'],
    },
    {
      id: 'vote_plan',
      label: 'Plan to vote?',
      type: 'select',
      options: ['Yes - Election Day', 'Yes - Early voting', 'Yes - By mail', 'Maybe', 'No'],
    },
    {
      id: 'needs_ride',
      label: 'Needs ride to polls?',
      type: 'select',
      options: ['Yes', 'No', 'Maybe'],
    },
  ],
}

export default campaignConfig
