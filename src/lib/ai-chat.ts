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
import { getVoterFile } from './mock-data'
import { matchPeopleToVoterFile, matchPeopleToVoterDb } from './matching'
import { getDatasetForCampaign } from './voter-db'
import { calculatePriority, sortByPriority } from './contact-priority'
import { calculateVoteScore, determineSegment } from './voter-segments'
import { CATEGORIES } from './wizard-config'
import { CONVERSATION_SCRIPTS, getRelationshipTip } from './scripts'
import { getAISettings } from './ai-settings'
import { streamGeminiChat } from './gemini-provider'
import { getAllPromptSections, interpolateTemplate, type PromptSectionId, type CampaignType } from './ai-prompts'
import type { AICampaignContext, PersonEntry, MatchResult, ActionPlanItem } from '@/types'

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

export function buildSystemPrompt(
  config: CampaignConfig,
  aiContext: AICampaignContext | undefined,
  volunteerState: VolunteerState,
  volunteerName?: string,
  existingContacts?: ExistingContact[],
  promptTemplates?: Record<string, string>,
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

  const vars: Record<string, string> = {
    campaignName: config.name,
    areaLabel,
    electionState,
    categoryList,
    scriptSummaries,
    relationshipTips,
    surveyQuestions,
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
  if (existingContacts && existingContacts.length > 0) {
    const contactsByCategory: Record<string, string[]> = {}
    for (const c of existingContacts) {
      const cat = c.category || 'other'
      if (!contactsByCategory[cat]) contactsByCategory[cat] = []
      const status = c.contacted ? `(contacted: ${c.outcome || 'unknown'})` : c.matchStatus === 'confirmed' ? '(matched)' : ''
      contactsByCategory[cat].push(`${c.firstName} ${c.lastName}${c.city ? `, ${c.city}` : ''} ${status}`.trim())
    }
    const contactList = Object.entries(contactsByCategory)
      .map(([cat, names]) => `- ${cat}: ${names.join('; ')}`)
      .join('\n')
    parts.push(`
## Existing Contacts Already in Rolodex
The volunteer already has ${existingContacts.length} people on their list. DO NOT re-add these people. Here is who they already have:
${contactList}

Use this to:
1. Skip anyone they already named — say "Got it, they're already on your list" and move on
2. Know which categories they've already covered vs which are empty
3. Ask about gaps: if they have household but no coworkers, ask about coworkers
4. Reference specific people when coaching conversations: "What about reaching out to [name]?"`)
  }

  // Rolodex instructions (from DB-backed template)
  parts.push(`\n${t('rolodex')}`)


  // Match confirmation flow (from DB-backed template)
  parts.push(`\n${t('match_confirmation')}`)



  // Transition logic (from DB-backed template)
  parts.push(`\n${t('transition')}`)


  // Coaching instructions (from DB-backed template)
  parts.push(`\n${t('coaching')}`)


  // Outcome collection (from DB-backed template)
  parts.push(`\n${t('debrief')}`)

  // Tool usage instructions (from DB-backed template)
  parts.push(`\n${t('tool_usage')}`)

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
      `INSERT INTO contacts (id, user_id, campaign_id, first_name, last_name, phone, address, city, zip, age, age_range, gender, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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

  const datasetId = await getDatasetForCampaign(ctx.campaignId)
  let results: MatchResult[]
  if (datasetId) {
    results = await matchPeopleToVoterDb(people, datasetId)
  } else {
    const config = await getCampaignConfig(ctx.campaignId)
    const voterFile = await getVoterFile(config.state, config.voterFile)
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
        birthYear: best.voterRecord.birth_year || null,
        party: best.voterRecord.party_affiliation || null,
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

  const contacts = rows.map(row => ({
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
  }))

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

// =============================================
// STREAMING CHAT
// =============================================

export interface ChatStreamOptions {
  userId: string
  campaignId: string
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  existingContacts?: ExistingContact[]
}

export async function* streamChat(
  options: ChatStreamOptions,
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const db = await getDb()
  const config = await getCampaignConfig(options.campaignId)
  const volunteerState = await loadVolunteerState(options.userId, options.campaignId)
  const aiSettings = await getAISettings()

  // Load volunteer name
  const { rows: userRows } = await db.query(
    'SELECT name FROM users WHERE id = $1', [options.userId],
  )
  const volunteerName = userRows[0]?.name || undefined

  // Load DB-backed prompt templates (resolves campaign-type overrides)
  const campaignType = (config.aiContext?.campaignType as CampaignType) || null
  const promptSections = await getAllPromptSections(campaignType)
  const promptTemplates: Record<string, string> = {}
  for (const s of promptSections) {
    if (s.id !== 'event_suggest') promptTemplates[s.id] = s.content
  }

  const systemPrompt = buildSystemPrompt(config, config.aiContext, volunteerState, volunteerName, options.existingContacts, promptTemplates)

  // Delegate to Gemini provider if configured
  if (aiSettings.provider === 'gemini') {
    yield* streamGeminiChat({
      model: aiSettings.chatModel,
      maxTokens: aiSettings.maxTokens,
      systemPrompt,
      history: options.history,
      message: options.message,
      userId: options.userId,
      campaignId: options.campaignId,
    })
    return
  }

  // Default: Anthropic provider
  const client = getAnthropicClient()
  const ctx: ToolContext = { userId: options.userId, campaignId: options.campaignId }

  // Build messages array
  const messages: Anthropic.MessageParam[] = [
    ...options.history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: options.message },
  ]

  let continueLoop = true

  while (continueLoop) {
    const stream = client.messages.stream({
      model: aiSettings.chatModel,
      max_tokens: aiSettings.maxTokens,
      system: systemPrompt,
      messages,
      tools: TOOL_DEFINITIONS,
    })

    let fullText = ''
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
    let currentToolId = ''
    let currentToolName = ''
    let currentToolInput = ''

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolId = event.content_block.id
          currentToolName = event.content_block.name
          currentToolInput = ''
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text
          yield { type: 'text', text: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          currentToolInput += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
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
      // Execute tools and feed results back
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const tool of toolUseBlocks) {
        const result = await executeTool(tool.name, tool.input, ctx)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result),
        })

        // Emit tool result to client for AppContext sync
        yield { type: 'tool_result', name: tool.name, input: tool.input, result }
      }

      // Add assistant message with tool calls + tool results to continue conversation
      messages.push({
        role: 'assistant',
        content: finalMessage.content,
      })
      messages.push({
        role: 'user',
        content: toolResults,
      })

      // Loop continues — AI will respond incorporating tool results
    } else {
      continueLoop = false
    }
  }

  yield { type: 'done' }
}
