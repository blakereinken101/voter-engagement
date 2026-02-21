export interface CampaignConfig {
  id: string
  name: string
  candidateName: string
  state: string
  electionDate?: string
  organizationName?: string
  privacyText?: string
}

/**
 * Default campaign configuration for development.
 * In production, this would be loaded from a URL parameter or admin setup.
 * The state is locked to the campaign — volunteers don't need to pick a state.
 */
const campaignConfig: CampaignConfig = {
  id: 'meyer-2026',
  name: 'Selena Meyer for President',
  candidateName: 'Selena Meyer',
  state: 'NC',
  electionDate: '2026-11-03',
  organizationName: 'Meyer for America',
  privacyText: 'Your data stays on your device. Names you enter are only used to match against public voter records. Nothing is stored on our servers. Each campaign\'s data is isolated — your work here is private to this campaign.',
}

export default campaignConfig
