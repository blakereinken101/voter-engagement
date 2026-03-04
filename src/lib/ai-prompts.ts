/**
 * AI Prompt Templates — Editable system prompt sections.
 *
 * Platform admins can view and edit each section of the AI system prompt.
 * Sections are stored in platform_settings and cached for 60 seconds.
 * Falls back to hardcoded defaults if no custom version exists.
 *
 * Server-only module.
 */

import { getDb } from './db'

// =============================================
// TYPES
// =============================================

export const PROMPT_SECTIONS = [
  '_directive',
  'identity',
  'rolodex',
  'match_confirmation',
  'transition',
  'coaching',
  'debrief',
  'tool_usage',
  'event_suggest',
  'fundraising',
] as const

export type PromptSectionId = typeof PROMPT_SECTIONS[number]

export type CampaignType = 'candidate' | 'ballot-measure' | 'issue-advocacy'
export const CAMPAIGN_TYPES: CampaignType[] = ['candidate', 'ballot-measure', 'issue-advocacy']

export interface PromptSection {
  id: PromptSectionId
  label: string
  description: string
  content: string
  isDefault: boolean
  availableVariables: string[]
}

interface StoredPromptValue {
  content: string
  updatedBy?: string
  updatedAt?: string
}

// =============================================
// SECTION METADATA
// =============================================

const SECTION_META: Record<PromptSectionId, { label: string; description: string; variables: string[] }> = {
  _directive: {
    label: 'Campaign Directive (Overrides All)',
    description: 'Top-level instructions that override all other prompt sections. Injected at the highest priority. Chat only — does not affect events or petitions.',
    variables: ['campaignName', 'areaLabel', 'jurisdictionDescription', 'electionState'],
  },
  identity: {
    label: 'Bot Identity & Persona',
    description: 'Defines who the AI is, its tone, formatting rules, and how it introduces itself to volunteers.',
    variables: ['campaignName', 'areaLabel', 'jurisdictionDescription', 'electionState'],
  },
  rolodex: {
    label: 'List Building (Rolodex Mode)',
    description: 'Instructions for how to collect contacts in batches — pacing, network mining, address rationale, and flow.',
    variables: ['categoryList', 'electionState', 'areaLabel', 'jurisdictionDescription'],
  },
  match_confirmation: {
    label: 'Match Confirmation Flow',
    description: 'How to present voter file matches to volunteers — confidence levels, multiple candidates, skip option.',
    variables: [],
  },
  transition: {
    label: 'Transition Logic',
    description: 'Milestones for shifting from list-building to conversations, volunteer recruitment, and vote tripling.',
    variables: [],
  },
  coaching: {
    label: 'Coaching Mode',
    description: 'Conversation guidance including deep canvassing framework, OARS technique, Story of Self, and confidence building.',
    variables: ['scriptSummaries', 'relationshipTips'],
  },
  debrief: {
    label: 'After-Conversation Debrief',
    description: 'How to debrief after volunteer conversations — outcome collection, handling tough experiences.',
    variables: ['surveyQuestions'],
  },
  tool_usage: {
    label: 'Tool Usage Instructions',
    description: 'When and how the AI should use each of its 7 tools (add_contact, run_matching, etc.).',
    variables: [],
  },
  event_suggest: {
    label: 'Event Suggest Prompt',
    description: 'System prompt for generating event titles and descriptions. Used by the magic wand feature on event creation.',
    variables: [],
  },
  fundraising: {
    label: 'Fundraising Coaching',
    description: 'Instructions for coaching volunteers on fundraising activities — personal asks, house parties, contribution limits, donor follow-up. Only used when fundraising is a top campaign priority.',
    variables: ['campaignName', 'contributionLimits', 'fundraisingGuidance'],
  },
}

// =============================================
// DEFAULT TEMPLATES
// Extracted from the hardcoded strings in ai-chat.ts buildSystemPrompt()
// =============================================

export const DEFAULT_TEMPLATES: Record<PromptSectionId, string> = {
  _directive: '',
  identity: `You are a campaign coach for "{{campaignName}}" in {{jurisdictionDescription}}. This platform is called "Threshold." Plain text only — no markdown formatting.`,

  rolodex: `## Rolodex Mode — Collecting Contacts

First step: Ask the volunteer if they live in {{jurisdictionDescription}}. Do not proceed with list-building until they answer.

Categories to walk through:
{{categoryList}}

Collect contacts who live in {{jurisdictionDescription}}. For each: first name, last name, city, address, rough age.`,

  match_confirmation: `## Match Confirmation Flow

Present voter file matches to the volunteer for confirmation. Never auto-confirm.`,

  transition: `## Transition Logic

Guide the volunteer from list-building to conversations based on their progress.`,

  coaching: `## Coaching Mode

{{scriptSummaries}}

{{relationshipTips}}`,

  debrief: `## After-Conversation Debrief

Log conversation outcomes using log_conversation.
{{surveyQuestions}}`,

  tool_usage: `## Tool Usage

- **add_contact**: Call ONCE per person after gathering info. Never call twice for the same person.
- **run_matching**: Use to find matches. Returns POTENTIAL matches only — includes address, party, district, and vote history. You MUST review matches with the volunteer and get confirmation.
- **get_next_contact**: Find the next best person to contact. Returns voter file match data (address, party, district) — use it to personalize coaching. Do not re-ask for information returned by this tool.
- **get_contact_details**: Look up a specific person. CRITICAL: If a volunteer mentions a contact already on their list, you MUST call this tool to retrieve their full info (address, party, district, vote history) BEFORE asking the volunteer for any details. Never ask for information you can look up.
- **get_contacts_summary**: Get progress stats.
- **log_conversation**: Record conversation outcomes.
- **update_match_status**: Save 'confirmed' or 'unmatched' after volunteer decides.
- **set_workflow_mode**: Set to 'voter-contact' or 'fundraising'.
- **record_event_rsvp**: Log yes/no/maybe for events.
- **get_upcoming_events**: Check campaign events.`,

  event_suggest: `You are a writing assistant for political event organizers. You help write compelling, concise event titles and descriptions.

CRITICAL: USE YOUR KNOWLEDGE. When the user mentions well-known public figures (politicians, activists, celebrities), organizations, movements, legislation, or current events, USE what you know about them. Reference their actual roles, accomplishments, positions, or relevance. Do NOT treat Hillary Clinton, Barack Obama, AOC, or any other widely known figure as if they were an unknown local person. If someone mentions a specific cause, bill, or movement, demonstrate you understand what it is and why it matters.

Read the user's existing draft carefully. Understand the CONTEXT and INTENT of what they've written. Your suggestion should build on their ideas, not replace them with generic filler. If they mention a specific topic, person, or cause, your output must reflect that specificity.

Rules for TITLES:
- Keep it under 60 characters
- Be specific and action-oriented
- Include the neighborhood or area when location info is available
- Match the energy of the event type
- Do NOT use generic filler like "Join us for..." — lead with the action or purpose
- If a notable person is involved, use their name and role appropriately

Rules for DESCRIPTIONS:
- 2-4 sentences maximum
- NEVER repeat the event title
- NEVER mention date, time, or location — those are displayed separately in the UI
- Focus on: what attendees will DO, why it MATTERS, what to BRING or expect
- If the event involves a known public figure, reference their actual significance — don't describe them generically
- Match the tone to the event type:
  - canvassing: practical, energizing — "here's what we'll accomplish together"
  - phone_bank: practical, clear — what the calls are about, who they're reaching
  - rally/protest: urgent, inspiring, movement-building language
  - town_hall/debate_watch: informative, civic-minded, what they'll learn
  - happy_hour/meetup: casual, welcoming, community-building
  - fundraiser: compelling case for support, mention the impact of donations
  - volunteer_training: practical, what skills they'll gain, who it's for
  - community/voter_registration: inclusive, empowering, grassroots energy
  - ballot_party: fun, informative, help people feel prepared

Always respond with ONLY the requested text. No quotes, no preamble, no explanation.`,

  fundraising: `## Fundraising Coaching Mode
Coach the volunteer on relational fundraising for "{{campaignName}}".

### Contribution Limits
{{contributionLimits}}

### Guidance
{{fundraisingGuidance}}

{{fundraiserTypeGuidance}}`,
}

// =============================================
// CACHING
// =============================================

let cachedSections: Map<string, StoredPromptValue> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000

export function invalidatePromptCache() {
  cachedSections = null
  cacheTimestamp = 0
}

async function loadAllFromDb(): Promise<Map<string, StoredPromptValue>> {
  const now = Date.now()
  if (cachedSections && now - cacheTimestamp < CACHE_TTL) {
    return cachedSections
  }

  try {
    const db = await getDb()
    const { rows } = await db.query(
      `SELECT key, value FROM platform_settings WHERE key LIKE 'ai_prompt_%'`
    )

    const map = new Map<string, StoredPromptValue>()
    for (const row of rows) {
      try {
        map.set(row.key, JSON.parse(row.value))
      } catch {
        // Skip malformed entries
      }
    }

    cachedSections = map
    cacheTimestamp = now
    return map
  } catch {
    return new Map()
  }
}

// =============================================
// PUBLIC API
// =============================================

/** DB key for a prompt section, optionally scoped to a campaign type */
function dbKey(sectionId: PromptSectionId, campaignType?: CampaignType | null): string {
  const base = `ai_prompt_${sectionId}`
  return campaignType ? `${base}__ct_${campaignType}` : base
}

/** Get a single prompt section, with campaign-type override resolution */
export async function getPromptSection(
  sectionId: PromptSectionId,
  campaignType?: CampaignType | null,
): Promise<PromptSection> {
  const allStored = await loadAllFromDb()
  const meta = SECTION_META[sectionId]
  const defaultContent = DEFAULT_TEMPLATES[sectionId]

  // Resolution: campaign-type override → base override → hardcoded default
  let content = defaultContent
  let isDefault = true

  if (campaignType) {
    const ctStored = allStored.get(dbKey(sectionId, campaignType))
    if (ctStored) {
      content = ctStored.content
      isDefault = false
    }
  }

  if (isDefault) {
    const baseStored = allStored.get(dbKey(sectionId))
    if (baseStored) {
      content = baseStored.content
      isDefault = false
    }
  }

  return {
    id: sectionId,
    label: meta.label,
    description: meta.description,
    content,
    isDefault,
    availableVariables: meta.variables,
  }
}

/** Get all prompt sections */
export async function getAllPromptSections(
  campaignType?: CampaignType | null,
): Promise<PromptSection[]> {
  // Load once, then resolve each section
  await loadAllFromDb()
  return Promise.all(PROMPT_SECTIONS.map(id => getPromptSection(id, campaignType)))
}

/** Update a prompt section */
export async function updatePromptSection(
  sectionId: PromptSectionId,
  content: string,
  campaignType?: CampaignType | null,
  updatedBy?: string,
): Promise<PromptSection> {
  const db = await getDb()
  const key = dbKey(sectionId, campaignType)
  const value: StoredPromptValue = {
    content,
    updatedBy,
    updatedAt: new Date().toISOString(),
  }

  await db.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  )

  invalidatePromptCache()
  return getPromptSection(sectionId, campaignType)
}

/** Reset a prompt section to its hardcoded default */
export async function resetPromptSection(
  sectionId: PromptSectionId,
  campaignType?: CampaignType | null,
): Promise<void> {
  const db = await getDb()
  const key = dbKey(sectionId, campaignType)

  await db.query(`DELETE FROM platform_settings WHERE key = $1`, [key])
  invalidatePromptCache()
}

/** Interpolate {{variables}} in a template string */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match)
}

/** Get the hardcoded default for a section (for "Reset to Default" UI) */
export function getDefaultTemplate(sectionId: PromptSectionId): string {
  return DEFAULT_TEMPLATES[sectionId]
}
