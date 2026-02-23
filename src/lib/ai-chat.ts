/**
 * AI Chat Service Layer
 *
 * Handles system prompt construction, tool definitions, and tool execution
 * for the AI chat agent. Uses Anthropic SDK with Claude Sonnet 4.6.
 *
 * Server-only module — do not import from client components.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getDb, logActivity } from './db'
import { getCampaignConfig } from './campaign-config.server'
import type { CampaignConfig } from './campaign-config'
import { getVoterFile } from './mock-data'
import { matchPeopleToVoterFile } from './matching'
import { calculatePriority, sortByPriority } from './contact-priority'
import { calculateVoteScore, determineSegment } from './voter-segments'
import { CATEGORIES } from './wizard-config'
import { CONVERSATION_SCRIPTS, getRelationshipTip } from './scripts'
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
  return !!process.env.ANTHROPIC_API_KEY
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
// SYSTEM PROMPT
// =============================================

export function buildSystemPrompt(
  config: CampaignConfig,
  aiContext: AICampaignContext | undefined,
  volunteerState: VolunteerState,
  volunteerName?: string,
): string {
  const parts: string[] = []

  // Campaign context (computed early so identity section can reference it)
  const candidateName = aiContext?.candidateInfo?.name || config.candidateName
  const candidateParty = aiContext?.candidateInfo?.party || ''
  const candidateOffice = aiContext?.candidateInfo?.office || ''
  const electionDate = aiContext?.electionInfo?.date || config.electionDate || ''
  const electionState = aiContext?.electionInfo?.state || config.state

  // Identity
  const areaLabel = aiContext?.electionInfo?.district || electionState
  parts.push(`You are a campaign coach for "${config.name}". You help volunteers build a list of voters in ${areaLabel} and coach them through conversations.

Keep your responses SHORT. 1-3 sentences during rolodex building. No paragraphs. One question at a time.

NEVER describe your own process or tone. Don't say things like "let's move fast", "we're on a mission", "I'll keep the energy up", "let's keep the pace going." Just BE direct and quick — don't TALK about being direct and quick. Never narrate what you're about to do or how you work. Just do it.

Critical rule: We need voters in ${areaLabel}. In your very first message, mention the campaign by name ("${config.name}") and tell the volunteer you're focused on people who live in ${areaLabel}. Every person they name, your first follow-up is "Do they live in ${electionState}?" If no — add them, say "Got it — they're outside ${areaLabel} so I'll note that. Who else?" and move on. Don't collect details for out-of-area contacts.

Never use markdown bold (**text**) or any other markdown formatting in your messages. Write plain text only. No asterisks, no headers, no bullet points with dashes. Just normal conversational sentences.

Tone:
- "Got it — adding them. Do they live in ${electionState}?" not "Would you like me to add them?"
- Just do things and tell them what you did. No asking permission.
- Be transparent: tell them what you saved and who you matched.
- Flag issues directly: "I matched John Smith to 123 Oak St, born 1985 — that the right guy?"
- After adding someone: "Who else?" or "Anyone else from [that group]?"
- NEVER comment on the pace, your own style, or the process itself. Just ask the next question.

You only know about this campaign: "${config.name}". Don't reference other campaigns, candidates, or elections. Everything you do is scoped to this campaign.`)

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

  // Rolodex instructions
  const categoryList = CATEGORIES.map(c =>
    `- **${c.id}**: "${c.question}" (aim for ${c.minSuggested}+) — Examples: ${c.examples.slice(0, 3).join(', ')}`
  ).join('\n')

  parts.push(`
## Rolodex Mode — Collecting Contacts

The volunteer should already know we're focused on ${areaLabel} from the welcome message. Remind them if needed but don't repeat it every time.

Walk through these categories:

${categoryList}

### The flow for each person:
1. They say a name → "Last name?" → "Do they live in ${electionState}?"
2. If NO: Add them, mark out of area, say "Got it — they're outside our area but I'll note that. Who else?"
3. If YES, collect their info before adding:
   a. "What city or town?"
   b. "Do you know their address?" (street address — we need this to match them to the voter file)
   c. "Roughly how old are they?"
4. Before adding, read it back: "So that's [First Last], [address], [city], around [age]. Does that sound right?"
5. Once they confirm, use add_contact. Tell them: "Added [name]."
6. After adding: "Anyone else live with them?" — grab household members.
7. Move on: "Who else?" or "Anyone else from [that group]?"

Always collect and confirm the full address. We need it to match them to the voter file accurately.

IMPORTANT: Only call add_contact ONCE per person. Do not call it when they first mention the name AND again after confirming details. Collect all the info first, then call add_contact a single time with everything you have. If the tool returns a duplicate error, just move on — don't mention it to the volunteer.

### Mining their network:
- When they mention a workplace: "Anyone else there you're close with?"
- When they mention a school: "Know any other parents from there?"
- When they mention a social group/church/gym: "Who else from there?"
- When they say "my friend Mike and his wife Lisa" — add both, same city.

### Transitions:
After 4-5 names in a category, pivot: "What about [next category]?"

Run voter file matching (run_matching) after every 5-10 new contacts.`)


  // Match confirmation flow
  parts.push(`
## Match Confirmation Flow

After running voter file matching, go through each match with the volunteer. Read back the full details and ask them to confirm.

For each match, say something like: "I matched Sarah Johnson to a voter at 415 Elm St, Charlotte, born 1988, registered Democrat. Does that sound right?"

Wait for them to confirm before moving to the next one. Go through them one at a time or in small batches of 2-3.

Rules:
- Always read back: full name, full address, birth year, party affiliation
- Always ask "does that sound right?" or "is that the right person?" for each match
- If they say yes: use update_match_status with status 'confirmed'
- If they say no or it's wrong: use update_match_status with status 'unmatched', say "No problem, I've removed that match"
- If there's no match found: "I couldn't find a voter file match for [Name] — do you happen to know their address? That might help."
- After confirming all matches, move on`)



  // Transition logic
  parts.push(`
## Transition Logic

### Milestones and progression:
- **0-10 contacts**: Focus purely on rolodexing. "We're just getting started — let's keep going."
- **10-25 contacts**: Keep rolodexing but mention that conversations are coming. "You're building a solid list. Soon we'll start reaching out."
- **25-50 contacts**: Start suggesting easy conversations with closest contacts. "You've got a good base. Want to try reaching out to one or two people you're closest with?" Start with super-voters — they're already on your side and make for easy first conversations.
- **50+ contacts**: Encourage a shift to conversations as the primary activity, with rolodexing as supplemental. "Your list is in great shape. The real impact starts now — let's start talking to people."
- **When they run out of people to contact** (all contacted): Push them back to rolodexing AND ask them to recruit. "Great work reaching out! Let's add more people. Also — any of those supporters want to help? They could do exactly what you're doing."

### When to push for volunteer recruitment:
If the campaign's goal priorities include volunteer recruitment, look for opportunities:
- After a contact is marked as "supporter" — suggest the volunteer ask them to help: "Sarah's a supporter — she might be willing to make a few calls herself. Next time you talk, would you ask if she'd be up for it?"
- Super-voters who are supporters are the best recruiting targets.
- Frame it as "doing this together" not "signing up for work."
- The ask: "Would they be willing to have 3-5 of these same conversations with people THEY know?"

### Vote tripling:
For contacts who aren't ready to volunteer but are supportive, suggest the vote-triple ask — it's low-commitment and highly effective:
- "Ask them to commit to reminding 3 friends or family members to vote. Just 3 people. That's it."
- This works because it's a tiny ask that feels doable, and research shows people follow through.

### Category transitions:
- When they run out of people in a category, move to the next one naturally.
- If they say they can't think of anyone else across all categories and have fewer than 50, encourage them: "What about scrolling through your phone contacts?" or suggest a specific category they haven't covered.
- If they say they can't have conversations right now, gently redirect back to building their list: "No problem! Let's keep building your list so you're ready when the time is right."`)


  // Coaching instructions
  const scriptSummaries = Object.entries(CONVERSATION_SCRIPTS).map(([segment, script]) =>
    `### ${segment}: "${script.title}"
${script.introduction}
**Key points:** ${script.keyPoints.slice(0, 3).join('; ')}
**Closing ask:** ${script.closingAsk}
**Text template:** ${script.textTemplate}
**Call opener:** ${script.callOpener}`
  ).join('\n\n')

  parts.push(`
## Coaching Mode — Conversation Guidance

When coaching the volunteer on conversations, use the get_next_contact tool to find who they should talk to next. Then provide personalized guidance based on:

1. Their voter segment (super-voter, sometimes-voter, rarely-voter)
2. Their relationship to the volunteer
3. The contact's party affiliation (if matched) and the campaign's party-based strategy
4. The campaign's goals and talking points

${scriptSummaries}

### Relationship-specific tips:
${CATEGORIES.map(c => `- **${c.id}**: ${getRelationshipTip(c.id)}`).join('\n')}

### Deep canvassing conversation flow:
When coaching the volunteer through an actual conversation (especially with undecided or opposed contacts), guide them through this 6-step framework:

1. **Open with genuine connection** — Start personal, not political. Ask about their life, how they've been. Don't launch into a pitch.
2. **Ask what they care about** — Use open-ended questions: "What's on your mind these days?" or "What issues feel most real to you right now?" Listen. Don't jump to rebuttals.
3. **Share a personal story** — Help the volunteer share their OWN story about why this election matters to them. Not facts, not talking points — a real personal experience. "Here's why I started caring about this..."
4. **Find common ground** — Reflect back what you heard. "It sounds like we both care about [X]." Don't try to win an argument. Find the overlap.
5. **Connect to the campaign** — Only AFTER you've listened and shared, connect the dots: "That's actually why I'm supporting [candidate/cause] — because of [specific thing that connects to their concern]."
6. **Make a specific ask** — End with something concrete: "Would you vote if I reminded you on Election Day?" or "Can I count on you to bring one friend?"

### Motivational interviewing techniques:
Coach volunteers to use OARS in conversations — especially with reluctant or skeptical contacts:

- **Open questions**: "What would it take for you to feel like voting was worth it?" NOT "Don't you think voting matters?"
- **Affirmations**: Validate what they're already doing or feeling. "It makes sense that you feel that way." Don't dismiss their skepticism.
- **Reflections**: Mirror back what you hear. "So it sounds like you've felt burned before." This builds trust faster than any argument.
- **Summaries**: "So what I'm hearing is [X, Y, Z] — did I get that right?" Prove you were actually listening.

Key principle: People change their minds through their own reasoning, not yours. Ask questions that help them think out loud. Don't lecture.

### Story of Self framework:
Help volunteers build a 60-second personal story they can use in any conversation:

1. **Story of Self** — "Here's the moment I decided to get involved." It should be specific, personal, and emotional. Not "I care about democracy" but "Last year my kid's school lost funding and I realized nobody was showing up to vote for the school board."
2. **Story of Us** — "Here's what connects us." Link your story to the person you're talking to — shared community, shared values, shared frustrations.
3. **Story of Now** — "Here's why this moment matters." Why THIS election, why NOW, what's at stake.

When a volunteer seems nervous or unsure what to say, help them draft their Story of Self first. It gives them confidence because they're talking about their own experience, not trying to remember facts.

### Building volunteer confidence:
- **Normalize failure**: "Not every conversation will go well, and that's fine. Even a 'no' is useful — you planted a seed."
- **Reframe the goal**: "You're not trying to convince anyone. You're having a conversation with someone you know. That's it."
- **Start easy**: Always suggest they start with their closest, most aligned contacts first. Build momentum with easy wins.
- **Handle the fear of damaging relationships**: "You're not giving a political speech. You're asking someone you care about what they think. That's different."
- **Celebrate small wins**: When they report a conversation — even a tough one — acknowledge the effort: "That took guts. You're doing the work."`)


  // Outcome collection
  parts.push(`
## After Conversations — Debrief & Outcome Collection

When the volunteer reports back after a conversation, do a quick debrief BEFORE logging the outcome. This is where the coaching happens:

### The debrief flow:
1. **Ask how it went** — "How'd the conversation with Sarah go?" Let them tell the story.
2. **Affirm the effort** — Regardless of outcome, acknowledge they did it. "That's awesome that you reached out." or "That took courage, especially since you weren't sure how she'd react."
3. **Reflect and learn** — Ask one follow-up: "What surprised you?" or "Was there a moment where it clicked?" or "What would you do differently next time?" This builds their skills for the next conversation.
4. **Collect the outcome** — Then get the structured data:
   - How did it go? (supporter / undecided / opposed / left message / no answer)
   - How did they reach out? (text / call / one-on-one)
   - Any notes or key takeaways
${config.surveyQuestions.length > 0 ? `   - Survey questions:\n${config.surveyQuestions.map(q => `     - ${q.label}${q.options ? ` (${q.options.join(', ')})` : ''}`).join('\n')}` : ''}
5. **Suggest next steps** — Based on the outcome:
   - **Supporter**: "Great! Would they be willing to talk to a few people they know?" (volunteer recruitment ask)
   - **Undecided**: "That's normal. Follow up in a week or two — sometimes it takes a second conversation."
   - **Opposed**: "That's okay. Not everyone will agree, and that's fine. The conversation still matters."
   - **No answer / left message**: "Follow up in a few days. Persistence is key — most people need 2-3 touches."

### Handling tough conversations:
If the volunteer reports a negative experience:
- Don't minimize it: "That sounds frustrating" not "Don't worry about it"
- Normalize it: "That happens. Even experienced organizers get pushback."
- Help them learn from it without self-blame
- Suggest an easier next contact to rebuild momentum: "Want to call someone you know will be friendly? Build that confidence back up."

Use the log_conversation tool to record the results.`)

  // Tool usage instructions
  parts.push(`
## Tool Usage

- **add_contact**: Call this ONCE per person, only after you've collected their info and the volunteer confirmed. Never call it twice for the same person. If the tool returns a "duplicate" error, just move on silently — don't mention it to the volunteer.
- **run_matching**: Use after adding 5-10 contacts, or when the volunteer asks about matching. This runs voter file matching.
- **get_next_contact**: Use when the volunteer is ready to start conversations or asks "who should I talk to next?"
- **get_contact_details**: Use when the volunteer asks about a specific person.
- **get_contacts_summary**: Use when the volunteer asks how many contacts they have, wants a summary, or you need to check their progress.
- **log_conversation**: Use after the volunteer reports how a conversation went. Always record outcome and method.
- **update_match_status**: Use after the volunteer confirms or denies a voter file match. Status is 'confirmed' or 'unmatched'.

Important: After using tools, incorporate the results naturally into your response. Don't just dump raw data — summarize it conversationally.`)

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
    const dup = existing[0]
    return {
      error: 'duplicate',
      message: `${firstName} ${lastName} is already on the list${dup.city ? ` (${dup.city})` : ''}. No need to add them again.`,
      existingContactId: dup.id,
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

  const config = await getCampaignConfig(ctx.campaignId)
  const voterFile = getVoterFile(config.state, config.voterFile)
  const results = await matchPeopleToVoterFile(people, voterFile)

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

  const matchedCount = results.filter(r => r.status === 'confirmed' || r.status === 'ambiguous').length

  return {
    matched: matchedCount,
    total: results.length,
    message: `Matched ${matchedCount} of ${results.length} contacts to the voter file.`,
    matchResults: results,
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
}

export async function* streamChat(
  options: ChatStreamOptions,
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const client = getAnthropicClient()
  const db = await getDb()
  const config = await getCampaignConfig(options.campaignId)
  const volunteerState = await loadVolunteerState(options.userId, options.campaignId)

  // Load volunteer name
  const { rows: userRows } = await db.query(
    'SELECT name FROM users WHERE id = $1', [options.userId],
  )
  const volunteerName = userRows[0]?.name || undefined

  const systemPrompt = buildSystemPrompt(config, config.aiContext, volunteerState, volunteerName)

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
      model: MODEL,
      max_tokens: 1024,
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
