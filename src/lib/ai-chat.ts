/**
 * AI Chat Service Layer
 *
 * Handles system prompt construction, tool definitions, and tool execution
 * for the AI chat agent. Supports both Anthropic (Claude) and Google (Gemini).
 *
 * Server-only module — do not import from client components.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getDb, logActivity } from './db'
import { getCampaignConfig } from './campaign-config.server'
import type { CampaignConfig } from './campaign-config'
import { getVoterFile, NoVoterDataError } from './mock-data'
import { matchPeopleToVoterFile, matchPeopleToVoterDb } from './matching'
import { getDatasetForCampaign } from './voter-db'
import { calculatePriority, sortByPriority } from './contact-priority'
import { calculateVoteScore, determineSegment } from './voter-segments'
import { CATEGORIES } from './wizard-config'
import { CONVERSATION_SCRIPTS, getRelationshipTip } from './scripts'
import { getAISettings } from './ai-settings'
import { streamGeminiChat, isGeminiEnabled, ProviderUnavailableError } from './gemini-provider'
import { getAllPromptSections, interpolateTemplate, type PromptSectionId, type CampaignType } from './ai-prompts'
import type { AICampaignContext, FundraisingConfig, FundraiserTypeConfig, PersonEntry, MatchResult, ActionPlanItem } from '@/types'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic()
  }
  return anthropicClient
}

export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || !!process.env.GEMINI_API_KEY
}

export function isAnthropicEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/** Get the default model for a provider when used as fallback */
function getFallbackModel(provider: 'anthropic' | 'gemini'): string {
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  }
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash'
}

/** Get the alternate provider if its API key is configured, else null */
function getAlternateProvider(current: 'anthropic' | 'gemini'): 'anthropic' | 'gemini' | null {
  if (current === 'gemini' && isAnthropicEnabled()) return 'anthropic'
  if (current === 'anthropic' && isGeminiEnabled()) return 'gemini'
  return null
}

// =============================================
// VOLUNTEER STATE
// =============================================

export interface VolunteerState {
  totalContacts: number
  matchedCount: number
  unmatchedCount: number
  contactedCount: number
  supporters: number
  undecided: number
  opposed: number
  noAnswer: number
  superVoters: number
  sometimesVoters: number
  rarelyVoters: number
}

export async function loadVolunteerState(userId: string, campaignId: string): Promise<VolunteerState> {
  const db = await getDb()
  const { rows } = await db.query(`
    SELECT
      COUNT(c.id) as total,
      COUNT(CASE WHEN mr.status = 'confirmed' THEN 1 END) as matched,
      COUNT(CASE WHEN mr.status = 'unmatched' OR mr.status = 'pending' THEN 1 END) as unmatched,
      COUNT(CASE WHEN ai.contacted = 1 THEN 1 END) as contacted,
      COUNT(CASE WHEN ai.contact_outcome = 'supporter' THEN 1 END) as supporters,
      COUNT(CASE WHEN ai.contact_outcome = 'undecided' THEN 1 END) as undecided,
      COUNT(CASE WHEN ai.contact_outcome = 'opposed' THEN 1 END) as opposed,
      COUNT(CASE WHEN ai.contact_outcome = 'no-answer' OR ai.contact_outcome = 'left-message' THEN 1 END) as no_answer,
      COUNT(CASE WHEN mr.segment = 'super-voter' THEN 1 END) as super_voters,
      COUNT(CASE WHEN mr.segment = 'sometimes-voter' THEN 1 END) as sometimes_voters,
      COUNT(CASE WHEN mr.segment = 'rarely-voter' THEN 1 END) as rarely_voters
    FROM contacts c
    LEFT JOIN match_results mr ON mr.contact_id = c.id
    LEFT JOIN action_items ai ON ai.contact_id = c.id
    WHERE c.user_id = $1 AND c.campaign_id = $2
  `, [userId, campaignId])

  const r = rows[0]
  return {
    totalContacts: parseInt(r.total) || 0,
    matchedCount: parseInt(r.matched) || 0,
    unmatchedCount: parseInt(r.unmatched) || 0,
    contactedCount: parseInt(r.contacted) || 0,
    supporters: parseInt(r.supporters) || 0,
    undecided: parseInt(r.undecided) || 0,
    opposed: parseInt(r.opposed) || 0,
    noAnswer: parseInt(r.no_answer) || 0,
    superVoters: parseInt(r.super_voters) || 0,
    sometimesVoters: parseInt(r.sometimes_voters) || 0,
    rarelyVoters: parseInt(r.rarely_voters) || 0,
  }
}

// =============================================
// EXISTING CONTACTS (for returning users)
// =============================================

export interface ExistingContact {
  firstName: string
  lastName: string
  category: string
  city: string | null
  matchStatus: string
  contacted: boolean
  outcome: string | null
}

export async function loadExistingContacts(userId: string, campaignId: string): Promise<ExistingContact[]> {
  const db = await getDb()
  const { rows } = await db.query(`
    SELECT c.first_name, c.last_name, c.category, c.city,
           mr.status as match_status, ai.contacted, ai.contact_outcome
    FROM contacts c
    LEFT JOIN match_results mr ON mr.contact_id = c.id
    LEFT JOIN action_items ai ON ai.contact_id = c.id
    WHERE c.user_id = $1 AND c.campaign_id = $2
    ORDER BY c.created_at ASC
  `, [userId, campaignId])
  return rows.map(r => ({
    firstName: r.first_name,
    lastName: r.last_name,
    category: r.category,
    city: r.city || null,
    matchStatus: r.match_status || 'pending',
    contacted: !!r.contacted,
    outcome: r.contact_outcome || null,
  }))
}

// =============================================
// SYSTEM PROMPT
// =============================================

/** Returns true if fundraising is the #1 or #2 goal priority for this campaign */
export function isFundraisingEnabled(aiContext: AICampaignContext | undefined): boolean {
  const priorities = aiContext?.goalPriorities || []
  const idx = priorities.indexOf('fundraising')
  return idx === 0 || idx === 1
}

export function buildSystemPrompt(
  config: CampaignConfig,
  aiContext: AICampaignContext | undefined,
  volunteerState: VolunteerState,
  volunteerName?: string,
  existingContacts?: ExistingContact[],
  promptTemplates?: Record<string, string>,
  volunteerWorkflowMode?: string | null,
  activeFundraiserTypeId?: string | null,
  upcomingFundraiserEvents?: { title: string; typeId: string; typeName: string }[],
  upcomingEvents?: { id: string; title: string; eventType: string; startTime: string }[],
): string {
  const parts: string[] = []

  // Campaign context (computed early so identity section can reference it)
  const candidateName = aiContext?.candidateInfo?.name || config.candidateName
  const candidateParty = aiContext?.candidateInfo?.party || ''
  const candidateOffice = aiContext?.candidateInfo?.office || ''
  const electionDate = aiContext?.electionInfo?.date || config.electionDate || ''
  const electionState = aiContext?.electionInfo?.state || config.state

  // Template variables shared across sections
  const areaLabel = aiContext?.electionInfo?.district || electionState
  const jurisdictionDescription = aiContext?.electionInfo?.district
    ? `${aiContext.electionInfo.district} in ${electionState}`
    : `the state of ${electionState}`
  const categoryList = CATEGORIES.map(c =>
    `- **${c.id}**: "${c.question}" (aim for ${c.minSuggested}+) — Examples: ${c.examples.slice(0, 3).join(', ')}`
  ).join('\n')
  const scriptSummaries = Object.entries(CONVERSATION_SCRIPTS).map(([segment, script]) =>
    `### ${segment}: "${script.title}"
${script.introduction}
**Key points:** ${script.keyPoints.slice(0, 3).join('; ')}
**Closing ask:** ${script.closingAsk}
**Text template:** ${script.textTemplate}
**Call opener:** ${script.callOpener}`
  ).join('\n\n')
  const relationshipTips = CATEGORIES.map(c => `- **${c.id}**: ${getRelationshipTip(c.id)}`).join('\n')
  const surveyQuestions = config.surveyQuestions.length > 0
    ? `   - Survey questions:\n${config.surveyQuestions.map(q => `     - ${q.label}${q.options ? ` (${q.options.join(', ')})` : ''}`).join('\n')}`
    : ''

  const contributionLimits = aiContext?.fundraisingConfig?.contributionLimits
    ? `The contribution limits for this race are: ${aiContext.fundraisingConfig.contributionLimits}. Volunteers should know these limits when making asks.`
    : 'No specific contribution limits have been configured for this campaign. If asked, remind the volunteer to check with the campaign for applicable federal, state, and local campaign finance rules.'

  const fundraisingGuidance = aiContext?.fundraisingConfig?.fundraisingGuidance || ''

  // Resolve active fundraiser type
  const fundraiserTypes = aiContext?.fundraisingConfig?.fundraiserTypes || []
  const activeType = activeFundraiserTypeId
    ? fundraiserTypes.find(ft => ft.id === activeFundraiserTypeId)
    : undefined

  const vars: Record<string, string> = {
    campaignName: config.name,
    areaLabel,
    jurisdictionDescription,
    electionState,
    categoryList,
    scriptSummaries,
    relationshipTips,
    surveyQuestions,
    contributionLimits,
    fundraisingGuidance,
    fundraiserTypeName: activeType?.name || '',
    fundraiserTypeGuidance: activeType?.guidance || '',
  }

  /** Resolve a section: use DB-backed template if available, otherwise use the raw template */
  const t = (sectionId: string): string => {
    const template = promptTemplates?.[sectionId]
    if (template !== undefined) return interpolateTemplate(template, vars)
    // Fallback: should not happen if promptTemplates were loaded, but safe default
    return ''
  }

  // Identity section (from DB-backed template)
  parts.push(t('identity'))

  // Volunteer identity
  if (volunteerName) {
    parts.push(`
## Volunteer
- Name: ${volunteerName}`)
  }

  parts.push(`
## Campaign Information
- Campaign: ${config.name}
- Candidate: ${candidateName}${candidateParty ? ` (${candidateParty})` : ''}
${candidateOffice ? `- Office: ${candidateOffice}\n` : ''}- State: ${electionState}
${electionDate ? `- Election Date: ${electionDate}` : ''}
${aiContext?.electionInfo?.district ? `- District: ${aiContext.electionInfo.district}` : ''}
${config.organizationName ? `- Organization: ${config.organizationName}` : ''}`)

  // AI campaign context (admin-configured)
  if (aiContext) {
    parts.push(`
## Campaign Goals & Messaging`)
    if (aiContext.goals) parts.push(`**Goals:** ${aiContext.goals}`)
    if (aiContext.goalPriorities?.length) {
      parts.push(`**Goal Priorities (in order):**\n${aiContext.goalPriorities.map((g, i) => `${i + 1}. ${g.replace(/-/g, ' ')}`).join('\n')}\n\nFocus volunteer efforts on the highest-priority goal first. When that goal is being met, shift to the next one.`)
    }
    if (aiContext.keyIssues?.length) parts.push(`**Key Issues:** ${aiContext.keyIssues.join(', ')}`)
    if (aiContext.talkingPoints?.length) parts.push(`**Talking Points:**\n${aiContext.talkingPoints.map(tp => `- ${tp}`).join('\n')}`)
    if (aiContext.messagingGuidance) parts.push(`**Messaging Guidance:** ${aiContext.messagingGuidance}`)

    // Party-based strategies
    if (aiContext.partyStrategies) {
      const ps = aiContext.partyStrategies
      const strategies = [
        ps.DEM && `- **Democrats (DEM):** ${ps.DEM}`,
        ps.REP && `- **Republicans (REP):** ${ps.REP}`,
        ps.UNF && `- **Unaffiliated / Independent (UNF/IND):** ${ps.UNF}`,
        ps.OTHER && `- **Other parties:** ${ps.OTHER}`,
      ].filter(Boolean).join('\n')
      if (strategies) {
        parts.push(`
## Party-Based Strategy

When coaching conversations, tailor the approach based on the contact's party affiliation from voter file match data:
${strategies}

Use the party_affiliation field from voter file matches to determine which strategy to use for each contact.`)
      }
    }

    // Custom survey questions
    if (aiContext.customSurveyQuestions?.length) {
      parts.push(`
## Custom Survey Questions
When logging conversations, also try to gather answers to these campaign-specific questions:
${aiContext.customSurveyQuestions.map(q => `- ${q.question}${q.type === 'select' && q.options?.length ? ` (Options: ${q.options.join(', ')})` : ''}`).join('\n')}

Record these as surveyResponses when using the log_conversation tool.`)
    }
  }

  // Volunteer state
  parts.push(`
## Current Volunteer Progress
- Total contacts: ${volunteerState.totalContacts}
- Matched to voter file: ${volunteerState.matchedCount}
- Contacted: ${volunteerState.contactedCount}
- Outcomes: ${volunteerState.supporters} supporters, ${volunteerState.undecided} undecided, ${volunteerState.opposed} opposed, ${volunteerState.noAnswer} no answer
- Segments: ${volunteerState.superVoters} super-voters, ${volunteerState.sometimesVoters} sometimes-voters, ${volunteerState.rarelyVoters} rarely-voters`)

  // Existing contacts — so AI knows who's already in the rolodex
  // Cap at 75 individual entries to keep prompt size manageable; summarize the rest
  if (existingContacts && existingContacts.length > 0) {
    const MAX_DETAILED_CONTACTS = 75
    const contactsByCategory: Record<string, string[]> = {}
    const detailed = existingContacts.length <= MAX_DETAILED_CONTACTS
      ? existingContacts
      : existingContacts.slice(-MAX_DETAILED_CONTACTS) // most recent entries
    for (const c of detailed) {
      const cat = c.category || 'other'
      if (!contactsByCategory[cat]) contactsByCategory[cat] = []
      const status = c.contacted ? `(contacted: ${c.outcome || 'unknown'})` : c.matchStatus === 'confirmed' ? '(matched)' : ''
      contactsByCategory[cat].push(`${c.firstName} ${c.lastName}${c.city ? `, ${c.city}` : ''} ${status}`.trim())
    }
    const contactList = Object.entries(contactsByCategory)
      .map(([cat, names]) => `- ${cat}: ${names.join('; ')}`)
      .join('\n')
    const truncationNote = existingContacts.length > MAX_DETAILED_CONTACTS
      ? `\n(Showing most recent ${MAX_DETAILED_CONTACTS} of ${existingContacts.length} contacts. The rest are tracked but omitted for brevity.)`
      : ''
    parts.push(`
## Existing Contacts Already in Rolodex
The volunteer already has ${existingContacts.length} people on their list. DO NOT re-add these people. Here is who they already have:
${contactList}${truncationNote}

Use this to:
1. Skip anyone they already named — say "Got it, they're already on your list" and move on
2. Know which categories they've already covered vs which are empty
3. Ask about gaps: if they have household but no coworkers, ask about coworkers
4. Reference specific people when coaching conversations: "What about reaching out to [name]?"`)
  }

  // Upcoming events — so AI can suggest inviting contacts and record RSVPs
  if (upcomingEvents && upcomingEvents.length > 0) {
    const eventList = upcomingEvents.map(e => {
      const date = new Date(e.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `- "${e.title}" (${e.eventType}, ${date}) — ID: ${e.id}`
    }).join('\n')
    parts.push(`
## Upcoming Events
The campaign has these upcoming events. When the volunteer mentions inviting someone to an event, or says someone is coming or not coming, use the record_event_rsvp tool to track their response (yes/no/maybe). Use get_upcoming_events to look up events if needed.
${eventList}`)
  }

  // Fundraising workflow branching
  const fundraisingEnabled = isFundraisingEnabled(aiContext)

  if (fundraisingEnabled && !volunteerWorkflowMode) {
    // Volunteer hasn't chosen a mode yet — add branching instructions
    parts.push(`
## Workflow Branching (OVERRIDES RESIDENCY QUESTION)
This campaign has fundraising as a high priority. After your initial greeting, BEFORE asking about residency or starting list-building, ask the volunteer what kind of work they're doing today. Use natural language like:

"Are you looking to have conversations with voters, or are you working on fundraising — like hosting a get-together or asking people to pitch in?"

Wait for their answer. Based on their response:
- If they say voter contact / talking to voters / canvassing / conversations / etc.: Call the set_workflow_mode tool with mode "voter-contact", then proceed with the normal residency question and list-building flow.
- If they say fundraising / donations / raising money / house party / event / etc.: Call the set_workflow_mode tool with mode "fundraising", then ${
      aiContext?.fundraisingConfig?.requireResidency
        ? 'ask the standard residency question before proceeding with fundraising coaching.'
        : 'skip the residency question entirely and go directly into fundraising coaching. Do NOT ask if they live in the area.'
    }

You MUST call set_workflow_mode before proceeding with either workflow. Ask this question ONCE — never re-ask it.`)

    // If fundraiser types are defined, tell the AI about them
    if (fundraiserTypes.length > 0) {
      parts.push(`
### Available Fundraiser Types
When the volunteer chooses fundraising, ask which type they're working on:
${fundraiserTypes.map(ft => `- "${ft.name}" (fundraiserTypeId: "${ft.id}")`).join('\n')}
Then call set_workflow_mode with mode "fundraising" and include the chosen fundraiserTypeId.`)
    }

    // If the volunteer has upcoming fundraiser event RSVPs, mention them
    if (upcomingFundraiserEvents && upcomingFundraiserEvents.length > 0) {
      parts.push(`
### Volunteer's Upcoming Fundraiser Events
This volunteer has RSVP'd to upcoming fundraiser events:
${upcomingFundraiserEvents.map(e => `- "${e.title}" (${e.typeName})`).join('\n')}
When they choose fundraising, ask if they're working on one of these events and use the corresponding type.`)
    }
  }

  // If volunteer chose fundraising but the campaign no longer has it as a priority,
  // treat them as having no mode set (fall through to normal voter-contact flow).
  const effectiveWorkflowMode = (volunteerWorkflowMode === 'fundraising' && !fundraisingEnabled)
    ? null
    : volunteerWorkflowMode

  if (effectiveWorkflowMode === 'fundraising') {
    parts.push(`
## Active Mode: FUNDRAISING${activeType ? ` — ${activeType.name}` : ''}
This volunteer has chosen the fundraising workflow. Do NOT ask the branching question again. Do NOT do rolodex list-building or voter contact coaching. Focus entirely on fundraising coaching.${
      !aiContext?.fundraisingConfig?.requireResidency
        ? ' Do NOT ask about residency — it is not required for fundraising in this campaign.'
        : ''
    }${activeType?.guidance ? `

### Specific Guidance for "${activeType.name}":
${activeType.guidance}` : ''}`)
  }

  if (effectiveWorkflowMode === 'voter-contact') {
    parts.push(`
## Active Mode: VOTER CONTACT
This volunteer has chosen the voter contact workflow. Do NOT ask the branching question again. Proceed with normal list-building and conversation coaching.`)
  }

  // Conditional section inclusion based on workflow mode
  if (effectiveWorkflowMode !== 'fundraising') {
    // Normal voter-contact flow (or mode not yet chosen)
    parts.push(`\n${t('rolodex')}`)
    parts.push(`\n${t('match_confirmation')}`)
    parts.push(`\n${t('transition')}`)
    parts.push(`\n${t('coaching')}`)
    parts.push(`\n${t('debrief')}`)
  } else {
    // Fundraising flow
    parts.push(`\n${t('fundraising')}`)
  }

  // Tool usage instructions (always included)
  let toolUsageText = t('tool_usage')
  if (!fundraisingEnabled) {
    // Scrub set_workflow_mode from tool usage text so the AI never sees
    // the word "fundraising" when it's disabled for this campaign
    toolUsageText = toolUsageText.replace(/.*set_workflow_mode.*/gi, '')
    parts.push(`\n${toolUsageText}`)
    parts.push('\nFundraising is NOT part of this campaign. Do NOT mention donations or fundraising under any circumstances.')
  } else {
    parts.push(`\n${toolUsageText}`)
  }

  // Campaign-specific directive — injected at the very top with highest priority.
  // Only present when a campaign admin sets promptOverrides._directive.
  const directive = promptTemplates?.['_directive']
  if (directive) {
    parts.unshift(`## CAMPAIGN-SPECIFIC DIRECTIVE (HIGHEST PRIORITY)

The following instructions are set by this campaign's administrator and take precedence over ALL other instructions in this prompt. If any section below conflicts with this directive, follow the directive.

${directive}

---`)
  }

  return parts.join('\n')
}

// =============================================
// TOOL DEFINITIONS
// =============================================

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'add_contact',
    description: 'Add a new contact to the volunteer\'s rolodex. Use this whenever the volunteer mentions someone they know.',
    input_schema: {
      type: 'object' as const,
      properties: {
        firstName: { type: 'string', description: 'First name of the contact' },
        lastName: { type: 'string', description: 'Last name of the contact' },
        phone: { type: 'string', description: 'Phone number (optional)' },
        address: { type: 'string', description: 'Street address (optional)' },
        city: { type: 'string', description: 'City (optional)' },
        zip: { type: 'string', description: 'ZIP code (optional)' },
        age: { type: 'number', description: 'Age (optional)' },
        gender: { type: 'string', enum: ['M', 'F', ''], description: 'Gender (optional)' },
        category: {
          type: 'string',
          enum: CATEGORIES.map(c => c.id),
          description: 'Relationship category',
        },
      },
      required: ['firstName', 'lastName', 'category'],
    },
  },
  {
    name: 'run_matching',
    description: 'Run voter file matching for all unmatched contacts. Use after adding several contacts.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'log_conversation',
    description: 'Log the result of a voter engagement conversation. Use after the volunteer reports how a conversation went.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: { type: 'string', description: 'The ID of the contact' },
        outcome: {
          type: 'string',
          enum: ['supporter', 'undecided', 'opposed', 'left-message', 'no-answer'],
          description: 'How the conversation went',
        },
        method: {
          type: 'string',
          enum: ['text', 'call', 'one-on-one'],
          description: 'How they reached out',
        },
        notes: { type: 'string', description: 'Any notes from the conversation (optional)' },
        surveyResponses: {
          type: 'object',
          description: 'Survey question responses as key-value pairs (optional)',
        },
      },
      required: ['contactId', 'outcome', 'method'],
    },
  },
  {
    name: 'get_next_contact',
    description: 'Get the highest-priority uncontacted person to reach out to next. Returns their details, voter segment, and coaching tips.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_contact_details',
    description: 'Get full details about a specific contact including match results and outreach history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactName: { type: 'string', description: 'Name of the contact to look up' },
      },
      required: ['contactName'],
    },
  },
  {
    name: 'get_contacts_summary',
    description: 'Get a summary of all contacts including counts by category, segment, and contact status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'update_match_status',
    description: 'Confirm or reject a voter file match for a contact. Use after the volunteer confirms or denies a match.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: { type: 'string', description: 'The ID of the contact' },
        status: {
          type: 'string',
          enum: ['confirmed', 'unmatched'],
          description: 'Whether the match is confirmed or rejected',
        },
      },
      required: ['contactId', 'status'],
    },
  },
  {
    name: 'set_workflow_mode',
    description: 'Set the volunteer workflow mode after they choose between voter contact and fundraising. For fundraising, optionally include the fundraiser type ID. Call this exactly once after the volunteer answers the branching question.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          enum: ['voter-contact', 'fundraising'],
          description: 'The workflow mode the volunteer chose',
        },
        fundraiserTypeId: {
          type: 'string',
          description: 'The ID of the fundraiser type (optional, for fundraising mode only)',
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'record_event_rsvp',
    description: 'Record whether a contact said yes, no, or maybe to attending an event. Use this when the volunteer says someone can or cannot make it to an event.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: { type: 'string', description: 'The ID of the contact' },
        eventId: { type: 'string', description: 'The ID of the event' },
        status: {
          type: 'string',
          enum: ['yes', 'no', 'maybe'],
          description: 'Whether the contact said yes, no, or maybe',
        },
        notes: { type: 'string', description: 'Optional notes about their response' },
      },
      required: ['contactId', 'eventId', 'status'],
    },
  },
  {
    name: 'get_upcoming_events',
    description: 'Get upcoming events for this campaign\'s organization. Use this to find events to invite contacts to or check event RSVPs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeContactRsvps: {
          type: 'boolean',
          description: 'If true, also return the volunteer\'s contact RSVP counts per event',
        },
      },
    },
  },
]

// =============================================
// TOOL EXECUTORS
// =============================================

interface ToolContext {
  userId: string
  campaignId: string
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'add_contact':
      return executeAddContact(input, ctx)
    case 'run_matching':
      return executeRunMatching(ctx)
    case 'log_conversation':
      return executeLogConversation(input, ctx)
    case 'get_next_contact':
      return executeGetNextContact(ctx)
    case 'get_contact_details':
      return executeGetContactDetails(input, ctx)
    case 'get_contacts_summary':
      return executeGetContactsSummary(ctx)
    case 'update_match_status':
      return executeUpdateMatchStatus(input, ctx)
    case 'set_workflow_mode':
      return executeSetWorkflowMode(input, ctx)
    case 'record_event_rsvp':
      return executeRecordEventRsvp(input, ctx)
    case 'get_upcoming_events':
      return executeGetUpcomingEvents(input, ctx)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

async function executeAddContact(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const db = await getDb()
  const contactId = crypto.randomUUID()

  const sanitize = (val: unknown, maxLen = 200): string | null =>
    typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) : null

  const firstName = sanitize(input.firstName, 50)
  const lastName = sanitize(input.lastName, 50)
  if (!firstName || !lastName) return { error: 'First and last name are required' }

  // Check for duplicate — same first+last name for this user+campaign
  const { rows: existing } = await db.query(
    `SELECT id, first_name, last_name, city, address FROM contacts
     WHERE user_id = $1 AND campaign_id = $2
       AND LOWER(first_name) = LOWER($3) AND LOWER(last_name) = LOWER($4)
     LIMIT 1`,
    [ctx.userId, ctx.campaignId, firstName, lastName],
  )
  if (existing.length > 0) {
    return {
      error: 'duplicate',
      existingContactId: existing[0].id,
      _instruction: 'This person was already added. Do NOT tell the volunteer. Just silently continue to the next person.',
    }
  }

  const safeAge = typeof input.age === 'number' && input.age >= 18 && input.age <= 120 ? Math.floor(input.age) : null
  const safeGender = (input.gender === 'M' || input.gender === 'F' || input.gender === '') ? input.gender : null
  const safeZip = typeof input.zip === 'string' ? input.zip.replace(/[^0-9]/g, '').slice(0, 5) : null
  const category = sanitize(input.category, 50) || 'who-did-we-miss'

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO contacts (id, user_id, campaign_id, first_name, last_name, phone, address, city, zip, age, age_range, gender, category, entry_method, entered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'chatbot', $2)`,
      [contactId, ctx.userId, ctx.campaignId, firstName, lastName,
       sanitize(input.phone, 20), sanitize(input.address, 200),
       sanitize(input.city, 50), safeZip, safeAge, null, safeGender, category],
    )
    await client.query(
      `INSERT INTO match_results (id, contact_id, status) VALUES ($1, $2, 'pending')`,
      [crypto.randomUUID(), contactId],
    )
    await client.query(
      `INSERT INTO action_items (id, contact_id) VALUES ($1, $2)`,
      [crypto.randomUUID(), contactId],
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  await logActivity(ctx.userId, 'add_contact', { contactId, name: `${firstName} ${lastName}`, source: 'ai_chat' }, ctx.campaignId)

  const contact: PersonEntry = {
    id: contactId,
    firstName,
    lastName,
    phone: sanitize(input.phone, 20) || undefined,
    address: sanitize(input.address, 200) || undefined,
    city: sanitize(input.city, 50) || undefined,
    zip: safeZip || undefined,
    age: safeAge || undefined,
    gender: (safeGender as PersonEntry['gender']) || undefined,
    category: category as PersonEntry['category'],
  }

  return { success: true, contact, contactId }
}

async function executeRunMatching(ctx: ToolContext): Promise<Record<string, unknown>> {
  const db = await getDb()

  // Load unmatched contacts
  const { rows: unmatched } = await db.query(`
    SELECT c.id, c.first_name, c.last_name, c.phone, c.address, c.city, c.zip, c.age, c.age_range, c.gender, c.category
    FROM contacts c
    JOIN match_results mr ON mr.contact_id = c.id
    WHERE c.user_id = $1 AND c.campaign_id = $2 AND mr.status = 'pending'
  `, [ctx.userId, ctx.campaignId])

  if (unmatched.length === 0) {
    return { matched: 0, total: 0, message: 'No unmatched contacts to process.' }
  }

  const people: PersonEntry[] = unmatched.map(row => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    zip: row.zip || undefined,
    age: row.age || undefined,
    ageRange: row.age_range || undefined,
    gender: row.gender || undefined,
    category: row.category,
  }))

  const assignment = await getDatasetForCampaign(ctx.campaignId)
  let results: MatchResult[]
  if (assignment) {
    results = await matchPeopleToVoterDb(people, assignment.datasetId, {}, assignment.filters)
  } else {
    let voterFile
    try {
      const config = await getCampaignConfig(ctx.campaignId)
      voterFile = await getVoterFile(config.state, config.voterFile)
    } catch (err) {
      if (err instanceof NoVoterDataError) {
        return { error: true, message: 'No voter data is configured for this campaign. An admin needs to upload a voter dataset in the platform admin before matching can work.' }
      }
      throw err
    }
    results = await matchPeopleToVoterFile(people, voterFile)
  }

  // Update match_results in DB
  for (const result of results) {
    await db.query(
      `UPDATE match_results SET
        status = $1, best_match_data = $2, candidates_data = $3,
        vote_score = $4, segment = $5, updated_at = NOW()
       WHERE contact_id = $6`,
      [
        result.status,
        result.bestMatch ? JSON.stringify(result.bestMatch) : null,
        JSON.stringify(result.candidates),
        result.voteScore ?? null,
        result.segment || null,
        result.personEntry.id,
      ],
    )
  }

  const foundCount = results.filter(r => r.status === 'ambiguous').length
  const unmatchedCount = results.filter(r => r.status === 'unmatched').length

  // Build a cleaner summary for the AI to present to the volunteer
  const matchSummary = results.map(r => {
    const person = r.personEntry
    const best = r.candidates[0]
    return {
      contactId: person.id,
      contactName: `${person.firstName} ${person.lastName}`,
      status: r.status,
      candidateCount: r.candidates.length,
      bestMatch: best ? {
        fullName: `${best.voterRecord.first_name} ${best.voterRecord.last_name}`,
        address: best.voterRecord.residential_address || null,
        city: best.voterRecord.city || null,
        state: best.voterRecord.state || null,
        birthYear: best.voterRecord.birth_year || null,
        party: best.voterRecord.party_affiliation || null,
        congressionalDistrict: best.voterRecord.congressional_district || null,
        stateSenateDistrict: best.voterRecord.state_senate_district || null,
        stateHouseDistrict: best.voterRecord.state_house_district || null,
        confidence: best.confidenceLevel,
        score: Math.round(best.score * 100),
        matchedOn: best.matchedOn,
      } : null,
      otherCandidates: r.candidates.slice(1).map(c => ({
        fullName: `${c.voterRecord.first_name} ${c.voterRecord.last_name}`,
        address: c.voterRecord.residential_address || null,
        city: c.voterRecord.city || null,
        birthYear: c.voterRecord.birth_year || null,
        party: c.voterRecord.party_affiliation || null,
        confidence: c.confidenceLevel,
        score: Math.round(c.score * 100),
      })),
      segment: r.segment || null,
      voteScore: r.voteScore ?? null,
    }
  })

  return {
    found: foundCount,
    unmatched: unmatchedCount,
    total: results.length,
    message: `Found potential voter file matches for ${foundCount} of ${results.length} contacts. None are confirmed yet — go through each one with the volunteer to verify.${unmatchedCount > 0 ? ` ${unmatchedCount} had no match found.` : ''}`,
    _instruction: 'IMPORTANT: These are POTENTIAL matches only. Every single match must be presented to the volunteer for confirmation. Never auto-confirm. Always read back the full address, birth year, and party, and ask "does that sound right?" before confirming any match.',
    matchSummary,
  }
}

async function executeLogConversation(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const db = await getDb()

  const contactId = input.contactId as string
  if (!contactId) return { error: 'contactId is required' }

  // Verify ownership
  const { rows } = await db.query(
    'SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND campaign_id = $3',
    [contactId, ctx.userId, ctx.campaignId],
  )
  if (!rows[0]) return { error: 'Contact not found' }

  const outcome = input.outcome as string
  const method = input.method as string
  const notes = typeof input.notes === 'string' ? input.notes.replace(/<[^>]*>/g, '').slice(0, 2000) : null
  const surveyResponses = input.surveyResponses && typeof input.surveyResponses === 'object'
    ? JSON.stringify(input.surveyResponses)
    : null

  await db.query(
    `UPDATE action_items SET
      contacted = 1, contacted_date = $1, outreach_method = $2,
      contact_outcome = $3, notes = $4, survey_responses = $5, updated_at = NOW()
     WHERE contact_id = $6`,
    [new Date().toISOString(), method, outcome, notes, surveyResponses, contactId],
  )

  await logActivity(ctx.userId, 'record_outcome', { contactId, outcome, method, source: 'ai_chat' }, ctx.campaignId)

  return {
    success: true,
    contactId,
    outcome,
    method,
  }
}

async function executeGetNextContact(ctx: ToolContext): Promise<Record<string, unknown>> {
  const db = await getDb()

  const { rows } = await db.query(`
    SELECT c.*, mr.status as mr_status, mr.best_match_data, mr.vote_score, mr.segment,
           ai.contacted, ai.contact_outcome, ai.outreach_method, ai.notes
    FROM contacts c
    LEFT JOIN match_results mr ON mr.contact_id = c.id
    LEFT JOIN action_items ai ON ai.contact_id = c.id
    WHERE c.user_id = $1 AND c.campaign_id = $2
    ORDER BY c.created_at ASC
  `, [ctx.userId, ctx.campaignId])

  if (rows.length === 0) {
    return { message: 'No contacts yet. Let\'s start building your list!' }
  }

  // Build action plan items and sort by priority
  const items: ActionPlanItem[] = rows.map(row => {
    const person: PersonEntry = {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone || undefined,
      city: row.city || undefined,
      category: row.category,
    }
    const matchResult: MatchResult = {
      personEntry: person,
      status: row.mr_status || 'pending',
      candidates: [],
      voteScore: row.vote_score ?? undefined,
      segment: row.segment || undefined,
      bestMatch: row.best_match_data ? JSON.parse(row.best_match_data) : undefined,
    }
    return {
      matchResult,
      contacted: !!row.contacted,
      contactOutcome: row.contact_outcome || undefined,
      outreachMethod: row.outreach_method || undefined,
      notes: row.notes || undefined,
    }
  })

  const sorted = sortByPriority(items)
  const next = sorted.find(item => !item.contacted)

  if (!next) {
    return {
      message: 'You\'ve contacted everyone on your list! Time to add more people.',
      allContacted: true,
      totalContacted: items.filter(i => i.contacted).length,
    }
  }

  const priority = calculatePriority(next)
  const person = next.matchResult.personEntry
  const segment = next.matchResult.segment
  const tip = getRelationshipTip(person.category)

  const bm = next.matchResult.bestMatch
  return {
    contactId: person.id,
    name: `${person.firstName} ${person.lastName}`,
    phone: person.phone || null,
    category: person.category,
    segment: segment || 'unknown',
    voteScore: next.matchResult.voteScore,
    priorityScore: priority,
    relationshipTip: tip,
    remainingUncontacted: sorted.filter(i => !i.contacted).length,
    voterMatch: bm ? {
      address: bm.residential_address || null,
      city: bm.city || null,
      state: bm.state || null,
      birthYear: bm.birth_year || null,
      party: bm.party_affiliation || null,
      congressionalDistrict: bm.congressional_district || null,
      stateSenateDistrict: bm.state_senate_district || null,
      stateHouseDistrict: bm.state_house_district || null,
    } : null,
  }
}

async function executeGetContactDetails(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const db = await getDb()
  const contactName = (input.contactName as string || '').toLowerCase().trim()

  if (!contactName) return { error: 'Contact name is required' }

  const { rows } = await db.query(`
    SELECT c.*, mr.status as mr_status, mr.best_match_data, mr.vote_score, mr.segment,
           ai.contacted, ai.contact_outcome, ai.outreach_method, ai.notes, ai.survey_responses
    FROM contacts c
    LEFT JOIN match_results mr ON mr.contact_id = c.id
    LEFT JOIN action_items ai ON ai.contact_id = c.id
    WHERE c.user_id = $1 AND c.campaign_id = $2
      AND (LOWER(c.first_name || ' ' || c.last_name) LIKE $3
           OR LOWER(c.first_name) LIKE $3
           OR LOWER(c.last_name) LIKE $3)
    LIMIT 5
  `, [ctx.userId, ctx.campaignId, `%${contactName}%`])

  if (rows.length === 0) {
    return { error: `No contact found matching "${input.contactName}"` }
  }

  // Batch-load event RSVPs for matched contacts
  const contactIds = rows.map(r => r.id)
  const { rows: rsvpRows } = await db.query(`
    SELECT cer.contact_id, cer.status, e.title, e.start_time
    FROM contact_event_rsvps cer
    JOIN events e ON e.id = cer.event_id
    WHERE cer.contact_id = ANY($1)
    ORDER BY e.start_time ASC
  `, [contactIds])

  const rsvpsByContact = new Map<string, Array<{ eventTitle: string; status: string; startTime: string }>>()
  for (const r of rsvpRows) {
    if (!rsvpsByContact.has(r.contact_id)) rsvpsByContact.set(r.contact_id, [])
    rsvpsByContact.get(r.contact_id)!.push({ eventTitle: r.title, status: r.status, startTime: r.start_time })
  }

  const contacts = rows.map(row => {
    const bm = row.best_match_data
      ? (typeof row.best_match_data === 'string' ? JSON.parse(row.best_match_data) : row.best_match_data)
      : null
    return {
      contactId: row.id,
      name: `${row.first_name} ${row.last_name}`,
      phone: row.phone || null,
      city: row.city || null,
      category: row.category,
      matchStatus: row.mr_status || 'pending',
      segment: row.segment || null,
      voteScore: row.vote_score ?? null,
      contacted: !!row.contacted,
      outcome: row.contact_outcome || null,
      method: row.outreach_method || null,
      notes: row.notes || null,
      surveyResponses: row.survey_responses ? JSON.parse(row.survey_responses) : null,
      eventRsvps: rsvpsByContact.get(row.id) || [],
      voterMatch: bm ? {
        address: bm.residential_address || null,
        city: bm.city || null,
        state: bm.state || null,
        birthYear: bm.birth_year || null,
        party: bm.party_affiliation || null,
        congressionalDistrict: bm.congressional_district || null,
        stateSenateDistrict: bm.state_senate_district || null,
        stateHouseDistrict: bm.state_house_district || null,
      } : null,
    }
  })

  return contacts.length === 1 ? contacts[0] : { matches: contacts }
}

async function executeGetContactsSummary(ctx: ToolContext): Promise<Record<string, unknown>> {
  const db = await getDb()

  const { rows } = await db.query(`
    SELECT c.category,
           COUNT(*) as count,
           COUNT(CASE WHEN mr.status = 'confirmed' THEN 1 END) as matched,
           COUNT(CASE WHEN ai.contacted = 1 THEN 1 END) as contacted,
           COUNT(CASE WHEN ai.contact_outcome = 'supporter' THEN 1 END) as supporters,
           COUNT(CASE WHEN ai.contact_outcome = 'undecided' THEN 1 END) as undecided,
           COUNT(CASE WHEN ai.contact_outcome = 'opposed' THEN 1 END) as opposed
    FROM contacts c
    LEFT JOIN match_results mr ON mr.contact_id = c.id
    LEFT JOIN action_items ai ON ai.contact_id = c.id
    WHERE c.user_id = $1 AND c.campaign_id = $2
    GROUP BY c.category
    ORDER BY count DESC
  `, [ctx.userId, ctx.campaignId])

  const total = rows.reduce((sum, r) => sum + parseInt(r.count), 0)
  const totalMatched = rows.reduce((sum, r) => sum + parseInt(r.matched), 0)
  const totalContacted = rows.reduce((sum, r) => sum + parseInt(r.contacted), 0)

  return {
    total,
    matched: totalMatched,
    contacted: totalContacted,
    byCategory: rows.map(r => ({
      category: r.category,
      count: parseInt(r.count),
      matched: parseInt(r.matched),
      contacted: parseInt(r.contacted),
      supporters: parseInt(r.supporters),
    })),
  }
}

async function executeUpdateMatchStatus(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const db = await getDb()
  const contactId = input.contactId as string
  const status = input.status as string

  if (!contactId || !['confirmed', 'unmatched'].includes(status)) {
    return { error: 'contactId and valid status (confirmed/unmatched) are required' }
  }

  // Verify ownership
  const { rows } = await db.query(
    'SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND campaign_id = $3',
    [contactId, ctx.userId, ctx.campaignId],
  )
  if (!rows[0]) return { error: 'Contact not found' }

  if (status === 'unmatched') {
    await db.query(
      `UPDATE match_results SET status = 'unmatched', best_match_data = NULL,
       vote_score = NULL, segment = NULL, updated_at = NOW()
       WHERE contact_id = $1`,
      [contactId],
    )
  } else {
    await db.query(
      `UPDATE match_results SET status = 'confirmed', updated_at = NOW()
       WHERE contact_id = $1`,
      [contactId],
    )
  }

  await logActivity(ctx.userId, 'match_status_update', { contactId, status, source: 'ai_chat' }, ctx.campaignId)

  return { success: true, contactId, status }
}

async function executeSetWorkflowMode(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const mode = input.mode as string
  if (!['voter-contact', 'fundraising'].includes(mode)) {
    return { error: 'Invalid mode. Must be "voter-contact" or "fundraising".' }
  }

  const payload: Record<string, unknown> = { workflowMode: mode }
  if (mode === 'fundraising' && input.fundraiserTypeId) {
    payload.activeFundraiserTypeId = input.fundraiserTypeId as string
  }

  const db = await getDb()
  await db.query(
    `UPDATE memberships
     SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb
     WHERE user_id = $2 AND campaign_id = $3`,
    [JSON.stringify(payload), ctx.userId, ctx.campaignId],
  )

  await logActivity(ctx.userId, 'set_workflow_mode', { mode, fundraiserTypeId: input.fundraiserTypeId || null, source: 'ai_chat' }, ctx.campaignId)

  return { success: true, mode, fundraiserTypeId: input.fundraiserTypeId || null }
}

async function executeRecordEventRsvp(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const db = await getDb()
  const contactId = input.contactId as string
  const eventId = input.eventId as string
  const status = input.status as string
  const notes = typeof input.notes === 'string' ? input.notes.replace(/<[^>]*>/g, '').slice(0, 500) : null

  if (!contactId || !eventId || !['yes', 'no', 'maybe'].includes(status)) {
    return { error: 'contactId, eventId, and valid status (yes/no/maybe) are required' }
  }

  // Verify contact ownership
  const { rows: contactRows } = await db.query(
    'SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND campaign_id = $3',
    [contactId, ctx.userId, ctx.campaignId],
  )
  if (!contactRows[0]) return { error: 'Contact not found' }

  // Verify event belongs to same org as contact's campaign
  const { rows: eventRows } = await db.query(`
    SELECT e.id, e.title FROM events e
    JOIN campaigns c ON c.org_id = e.organization_id
    WHERE e.id = $1 AND c.id = $2
  `, [eventId, ctx.campaignId])
  if (!eventRows[0]) return { error: 'Event not found for this campaign' }

  const id = crypto.randomUUID()
  await db.query(`
    INSERT INTO contact_event_rsvps (id, contact_id, event_id, status, notes, recorded_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (contact_id, event_id) DO UPDATE SET
      status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = NOW()
  `, [id, contactId, eventId, status, notes, ctx.userId])

  await logActivity(ctx.userId, 'record_event_rsvp', { contactId, eventId, status, source: 'ai_chat' }, ctx.campaignId)

  return {
    success: true,
    contactId,
    eventId,
    eventTitle: eventRows[0].title,
    status,
  }
}

async function executeGetUpcomingEvents(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const db = await getDb()
  const includeRsvps = !!input.includeContactRsvps

  const { rows: events } = await db.query(`
    SELECT e.id, e.title, e.event_type, e.start_time, e.location_name,
           e.location_city, e.is_virtual
    FROM events e
    JOIN campaigns c ON c.org_id = e.organization_id
    WHERE c.id = $1 AND e.status = 'published' AND e.start_time > NOW()
    ORDER BY e.start_time ASC
    LIMIT 10
  `, [ctx.campaignId])

  if (events.length === 0) {
    return { events: [], message: 'No upcoming events found.' }
  }

  let result = events.map((e: Record<string, unknown>) => ({
    eventId: e.id,
    title: e.title,
    type: e.event_type,
    startTime: e.start_time,
    location: e.is_virtual ? 'Virtual' : ((e.location_city || e.location_name || 'TBD') as string),
  }))

  if (includeRsvps) {
    const eventIds = events.map((e: Record<string, unknown>) => e.id)
    const { rows: rsvpCounts } = await db.query(`
      SELECT cer.event_id,
             COUNT(*) FILTER (WHERE cer.status = 'yes') as yes_count,
             COUNT(*) FILTER (WHERE cer.status = 'no') as no_count,
             COUNT(*) FILTER (WHERE cer.status = 'maybe') as maybe_count
      FROM contact_event_rsvps cer
      JOIN contacts c ON c.id = cer.contact_id
      WHERE c.user_id = $1 AND c.campaign_id = $2
        AND cer.event_id = ANY($3)
      GROUP BY cer.event_id
    `, [ctx.userId, ctx.campaignId, eventIds])

    const countsMap = new Map(rsvpCounts.map((r: Record<string, unknown>) => [r.event_id, {
      yes: parseInt(r.yes_count as string), no: parseInt(r.no_count as string), maybe: parseInt(r.maybe_count as string),
    }]))

    result = result.map(e => ({
      ...e,
      contactRsvps: countsMap.get(e.eventId) || { yes: 0, no: 0, maybe: 0 },
    }))
  }

  return { events: result }
}

// =============================================
// STREAMING CHAT
// =============================================

export interface ChatStreamOptions {
  userId: string
  campaignId: string
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }>
  existingContacts?: ExistingContact[]
  volunteerWorkflowMode?: string | null
  activeFundraiserTypeId?: string | null
  upcomingFundraiserEvents?: { title: string; typeId: string; typeName: string }[]
  upcomingEvents?: { id: string; title: string; eventType: string; startTime: string }[]
  /** Pre-loaded campaign config to avoid redundant DB fetch */
  campaignConfig?: CampaignConfig
}

export async function* streamChat(
  options: ChatStreamOptions,
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const db = await getDb()

  // Use pre-loaded config if available, otherwise fetch (with cache)
  const configPromise = options.campaignConfig
    ? Promise.resolve(options.campaignConfig)
    : getCampaignConfig(options.campaignId)

  // Parallelize all independent setup queries
  const [config, volunteerState, aiSettings, userRows] = await Promise.all([
    configPromise,
    loadVolunteerState(options.userId, options.campaignId),
    getAISettings(),
    db.query('SELECT name FROM users WHERE id = $1', [options.userId]),
  ])

  const volunteerName = userRows.rows[0]?.name || undefined

  // Load DB-backed prompt templates (depends on config for campaignType)
  const campaignType = (config.aiContext?.campaignType as CampaignType) || null
  const promptSections = await getAllPromptSections(campaignType)
  const promptTemplates: Record<string, string> = {}
  for (const s of promptSections) {
    if (s.id !== 'event_suggest' && s.id !== '_directive') promptTemplates[s.id] = s.content
  }

  // Per-campaign prompt overrides take highest priority — override everything
  // (platform defaults, base overrides, campaign-type overrides).
  // Only for chat sections, not event_suggest.
  const campaignOverrides = config.aiContext?.promptOverrides
  if (campaignOverrides) {
    for (const [sectionId, content] of Object.entries(campaignOverrides)) {
      if (sectionId !== 'event_suggest' && content) {
        promptTemplates[sectionId] = content
      }
    }
  }

  const systemPrompt = buildSystemPrompt(config, config.aiContext, volunteerState, volunteerName, options.existingContacts, promptTemplates, options.volunteerWorkflowMode, options.activeFundraiserTypeId, options.upcomingFundraiserEvents, options.upcomingEvents)

  const fundraisingActive = isFundraisingEnabled(config.aiContext)
  let useProvider: 'gemini' | 'anthropic' = aiSettings.provider
  let useModel: string = aiSettings.chatModel

  // ── Gemini path (with fallback to Anthropic) ──────────────────────
  if (useProvider === 'gemini') {
    let textYielded = false
    let fellBack = false

    try {
      const geminiGen = streamGeminiChat({
        model: useModel,
        maxTokens: aiSettings.maxTokens,
        systemPrompt,
        history: options.history,
        message: options.message,
        userId: options.userId,
        campaignId: options.campaignId,
        fundraisingEnabled: fundraisingActive,
      })

      for await (const event of geminiGen) {
        if (event.type === 'text') textYielded = true
        yield event
      }
    } catch (err) {
      const alt = getAlternateProvider('gemini')
      const canFallback = !textYielded
        && err instanceof ProviderUnavailableError
        && err.isFallbackEligible
        && alt !== null

      if (canFallback) {
        console.warn(`[ai-chat] Gemini unavailable (${(err as Error).message}), falling back to ${alt} with model ${getFallbackModel(alt!)}`)
        fellBack = true
        useProvider = alt!
        useModel = getFallbackModel(alt!)
      } else {
        console.error('[ai-chat] Gemini error (no fallback):', err)
        yield { type: 'error', message: 'Gemini encountered an error. Please try again or switch to a different AI provider in settings.' }
        return
      }
    }

    if (!fellBack) return
  }

  // ── Anthropic path (primary or fallback target) ───────────────────
  const client = getAnthropicClient()
  const ctx: ToolContext = { userId: options.userId, campaignId: options.campaignId }

  const activeTools = fundraisingActive
    ? TOOL_DEFINITIONS
    : TOOL_DEFINITIONS.filter(t => t.name !== 'set_workflow_mode')

  const messages: Anthropic.MessageParam[] = [
    ...options.history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as Anthropic.MessageParam['content'],
    })),
    { role: 'user', content: options.message },
  ]

  let continueLoop = true
  let anthropicTextYielded = false

  try {
    while (continueLoop) {
      const stream = client.messages.stream({
        model: useModel,
        max_tokens: aiSettings.maxTokens,
        system: systemPrompt,
        messages,
        tools: activeTools,
      })

      let fullText = ''
      const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
      let currentToolId = ''
      let currentToolName = ''
      let currentToolInput = ''

      let insideThinkingBlock = false

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if ((event.content_block as { type: string }).type === 'thinking') {
            insideThinkingBlock = true
          } else if (event.content_block.type === 'tool_use') {
            insideThinkingBlock = false
            currentToolId = event.content_block.id
            currentToolName = event.content_block.name
            currentToolInput = ''
          } else {
            insideThinkingBlock = false
          }
        } else if (event.type === 'content_block_delta') {
          if (insideThinkingBlock) {
            // Skip thinking_delta, signature_delta — never yield internal reasoning
          } else if (event.delta.type === 'text_delta') {
            fullText += event.delta.text
            anthropicTextYielded = true
            yield { type: 'text', text: event.delta.text }
          } else if (event.delta.type === 'input_json_delta') {
            currentToolInput += event.delta.partial_json
          }
        } else if (event.type === 'content_block_stop') {
          insideThinkingBlock = false
          if (currentToolId && currentToolName) {
            let parsedInput: Record<string, unknown> = {}
            try {
              if (currentToolInput) parsedInput = JSON.parse(currentToolInput)
            } catch { /* empty input is ok */ }
            toolUseBlocks.push({ id: currentToolId, name: currentToolName, input: parsedInput })
            currentToolId = ''
            currentToolName = ''
            currentToolInput = ''
          }
        }
      }

      const finalMessage = await stream.finalMessage()

      if (toolUseBlocks.length > 0) {
        const toolExecutions = await Promise.all(
          toolUseBlocks.map(tool => executeTool(tool.name, tool.input, ctx))
        )

        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (let i = 0; i < toolUseBlocks.length; i++) {
          const tool = toolUseBlocks[i]
          const result = toolExecutions[i]
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: JSON.stringify(result),
          })
          yield { type: 'tool_result', id: tool.id, name: tool.name, input: tool.input, result }
        }

        messages.push({ role: 'assistant', content: finalMessage.content })
        messages.push({ role: 'user', content: toolResults })
      } else {
        continueLoop = false
      }
    }
  } catch (err) {
    // Anthropic → Gemini fallback on overloaded errors
    const isOverloaded = err instanceof Anthropic.APIError && (err.status === 529 || err.status === 503)
    const alt = getAlternateProvider('anthropic')
    const canFallback = !anthropicTextYielded && isOverloaded && alt !== null

    if (canFallback) {
      const apiErr = err as InstanceType<typeof Anthropic.APIError>
      console.warn(`[ai-chat] Anthropic unavailable (status ${apiErr.status}), falling back to ${alt} with model ${getFallbackModel(alt!)}`)
      try {
        yield* streamGeminiChat({
          model: getFallbackModel(alt!),
          maxTokens: aiSettings.maxTokens,
          systemPrompt,
          history: options.history,
          message: options.message,
          userId: options.userId,
          campaignId: options.campaignId,
          fundraisingEnabled: fundraisingActive,
        })
      } catch (geminiErr) {
        console.error('[ai-chat] Gemini fallback also failed:', geminiErr)
        yield { type: 'error', message: 'Both AI providers are temporarily unavailable. Please try again in a moment.' }
      }
      return
    }

    console.error('[ai-chat] Anthropic error (no fallback):', err)
    yield { type: 'error', message: 'The AI service encountered an error. Please try again.' }
    return
  }

  yield { type: 'done' }
}
