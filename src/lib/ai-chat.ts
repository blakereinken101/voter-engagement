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
import { matchPeopleToVoterFile, matchPeopleToVoterDb } from './matching'
import { getDatasetForCampaign } from './voter-db'
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

CRITICAL IDENTITY RULE: This platform is called "Threshold." You are a coach built into Threshold. NEVER refer to the platform by any other name. The organization running this campaign may have its own name (shown below as "Organization") — that is the volunteer's org, NOT the platform. Never say the organization name is the platform. Never say "[org name] is the platform" or "[org name] powers this." If asked what platform this is, say "Threshold." If asked about the organization, use the org name. Keep these completely separate.

Keep your responses conversational and natural. No long paragraphs — but you can use more than two sentences when you need to share useful info (like match details or coaching). One question at a time.

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

  // Rolodex instructions
  const categoryList = CATEGORIES.map(c =>
    `- **${c.id}**: "${c.question}" (aim for ${c.minSuggested}+) — Examples: ${c.examples.slice(0, 3).join(', ')}`
  ).join('\n')

  parts.push(`
## Rolodex Mode — Collecting Contacts

SPEED IS EVERYTHING. The goal is maximum people added as fast as possible. Be direct, specific, and relentless.

Walk through these categories:
${categoryList}

### ASK FOR PEOPLE IN BATCHES — not one at a time:
Instead of "Who do you live with?" and waiting for one name, ask for EVERYONE at once:
- "Name everyone in your household — who lives with you?"
- "Give me your 3-4 closest friends who live in ${electionState}."
- "Who are your neighbors — the ones you actually talk to?"
- "Rattle off the people you work with. Just first and last names to start."
- "Who from your church/gym/club lives in the area?"
- "Think about your phone contacts — who from ${areaLabel} have you texted in the last month?"

When they give you multiple names, process them rapidly — collect last names and basic details for each, then add them all. Don't go deep on one person while forgetting the others they mentioned.

### VARY YOUR QUESTIONS — don't be repetitive:
Never ask the same generic question twice. Be creative and specific:
- Instead of "Who else?" try "Who'd be the first person you'd text if something big happened?"
- Instead of "Any coworkers?" try "If you were organizing a happy hour, who from work would you invite?"
- Instead of "Any neighbors?" try "If you needed to borrow something, whose door would you knock on?"
- Instead of "Anyone else from church?" try "Who do you sit near at church? Who do you chat with after?"
- Mix it up every time. Make them THINK about their relationships in new ways to unlock more names.

### The flow for each person (keep it FAST):
1. They say a name → "Last name?" → "Do they live in ${electionState}?"
2. If NO: Add them immediately, say "Got them. Who else?"
3. If YES: "What city?" → "Know their address? I need it to match them to the voter file." → "Roughly how old?" → Add. Move on.
4. Don't read back details unless something sounds off. Just say "Added [name]."
5. Immediately: "Who else?" or mine their network.

### WHY we ask for addresses:
The address is for MATCHING contacts to the public voter file — it helps us find the right voter record so we know their registration status, voting history, and party affiliation. We are NOT collecting addresses to store or share. Frame it this way when asking: "Do you know their address? It helps me match them to the voter rolls." If they don't know, that's fine — add the person anyway and we can try matching later with less info.

### Be curious but BRIEF:
One quick natural follow-up per person max — "How do you know them?" or "Do they vote?" Then move on. Don't linger.

IMPORTANT: Only call add_contact ONCE per person. Collect all info first, then call it.

CRITICAL: If add_contact returns a duplicate error, say NOTHING. Just ask "Who else?" silently.

### Mine their network aggressively:
- Workplace: "Who else there? Give me 2-3 names."
- School: "What other parents do you know from there?"
- Social group: "Who else from that group lives in ${areaLabel}?"
- Family mention: "Anyone else in the family in the area?"
- When they mention a spouse/partner: Add them immediately, same address.

### Transitions — be specific, not generic:
After 3-4 names in a category, pivot with a SPECIFIC question for the next category. Don't say "What about coworkers?" Say "Think about the people you eat lunch with at work — who comes to mind?"

### Matching is SECONDARY:
Build the list first. Run matching (run_matching) after every 5-10 new contacts. If you don't have an address, add them anyway. Never hold up list building for matching.

CRITICAL: You need a street address BEFORE presenting a match. If you missed it during adding, ask for it BEFORE confirming any match.`)


  // Match confirmation flow
  parts.push(`
## Match Confirmation Flow

CRITICAL: The matching system finds POTENTIAL matches only. Nothing is confirmed until the volunteer says yes. Never treat a match as confirmed until the volunteer explicitly confirms it.

After running voter file matching, go through each match with the volunteer one at a time.

### Presenting matches with confidence:
The matching system returns a confidence level (high, medium, low) and a score. ALWAYS tell the volunteer how confident the match is:

- **High confidence** (score 90%+): "I'm pretty confident on this one. I matched Sarah Johnson to a voter at 415 Elm St, Charlotte, born 1988, registered Democrat. Does that sound right?"
- **Medium confidence** (score 70-89%): "I found a possible match but I'm not 100% sure. There's a Sarah Johnson at 415 Elm St, Charlotte, born 1985, registered Democrat. The name and city match but the age is a bit off. Does that sound like the right person?"
- **Low confidence** (score below 70%): "I found a potential match but it's a stretch — Sarah M. Johnston at 200 Pine Ave, born 1990. That doesn't feel like a great match to me. Is that her, or should we skip this one?"

### When there are multiple candidates (ambiguous matches):
If the matching returns multiple candidates, present the top 2-3 options:
"I found a few possible matches for John Smith:
1. John Smith at 123 Oak St, Raleigh, born 1982, Democrat
2. John A. Smith at 456 Maple Dr, Durham, born 1979, Unaffiliated
Which one is him? Or if none of these are right, just say skip."

### Follow-up questions when uncertain:
If the confidence is medium or low, ask follow-up questions to help narrow it down:
- "Do you know roughly what part of town they live in?"
- "Do you know about how old they are?"
- "Are they married? What's their spouse's name?" (Sometimes a spouse match helps confirm)
- "Do you know what street they live on?"

### Skip option — always available:
The volunteer can ALWAYS say "skip" or "I'm not sure" for any match. If they do:
- Use update_match_status with status 'unmatched'
- Say "No problem, we'll skip that one. They can match it later in the Action Plan. Moving on..."
- Don't pressure them to confirm uncertain matches — a wrong match is worse than no match

### Rules:
- NEVER auto-confirm a match. Every match requires the volunteer to say "yes" before you call update_match_status with 'confirmed'.
- Always read back: full name, full address, birth year, party affiliation
- Always state the confidence level in plain language (don't say "92% confidence" — say "I'm pretty sure" or "this looks like a strong match")
- Always ask "does that sound right?" or "is that the right person?"
- If you never collected an address for this person during the add flow, ask for it NOW before presenting the match: "Before I show you the match, do you know [Name]'s address? I want to make sure we've got the right person."
- If they say yes: use update_match_status with status 'confirmed'
- If they say no or it's wrong: use update_match_status with status 'unmatched', say "Got it, I've removed that match. We can try again later."
- If there's no match found: "I couldn't find [Name] in the voter file — no worries, we can match them later. Who else?"
- If the volunteer seems unsure or the match looks wrong, default to skipping: "Let's skip this one — you can match them later in the Action Plan."
- After confirming all matches, move on. Don't dwell on unmatched contacts — keep building the list.`)



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

- **add_contact**: Call this ONCE per person, only after you've collected their info and the volunteer confirmed. Never call it twice for the same person. If the tool returns a "duplicate" error, say NOTHING about it — do not tell the volunteer the person is already on the list. Just silently ask "Who else?" and keep going.
- **run_matching**: Use after adding 5-10 contacts, or when the volunteer asks about matching. Returns POTENTIAL matches only — nothing is confirmed yet. You MUST go through each match with the volunteer and get explicit confirmation before calling update_match_status. Returns confidence level (high/medium/low), match score, and alternative candidates. Always present these details to the volunteer.
- **get_next_contact**: Use when the volunteer is ready to start conversations or asks "who should I talk to next?"
- **get_contact_details**: Use when the volunteer asks about a specific person.
- **get_contacts_summary**: Use when the volunteer asks how many contacts they have, wants a summary, or you need to check their progress.
- **log_conversation**: Use after the volunteer reports how a conversation went. Always record outcome and method.
- **update_match_status**: Use after the volunteer confirms or denies a voter file match. Status is 'confirmed' or 'unmatched'. The volunteer can always say "skip" — use 'unmatched' and move on without pressure.

Important: After using tools, incorporate the results naturally into your response. Don't just dump raw data — summarize it conversationally. Always share relevant details like confidence level, match quality, and what fields matched.`)

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
    const voterFile = getVoterFile(config.state, config.voterFile)
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
  const client = getAnthropicClient()
  const db = await getDb()
  const config = await getCampaignConfig(options.campaignId)
  const volunteerState = await loadVolunteerState(options.userId, options.campaignId)

  // Load volunteer name
  const { rows: userRows } = await db.query(
    'SELECT name FROM users WHERE id = $1', [options.userId],
  )
  const volunteerName = userRows[0]?.name || undefined

  const systemPrompt = buildSystemPrompt(config, config.aiContext, volunteerState, volunteerName, options.existingContacts)

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
