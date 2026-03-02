import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAIEnabled, isFundraisingEnabled, streamChat, loadExistingContacts } from '@/lib/ai-chat'
import { getAISettings } from '@/lib/ai-settings'
import { getCampaignConfig } from '@/lib/campaign-config.server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured. Set ANTHROPIC_API_KEY to enable.' },
        { status: 503 },
      )
    }

    const ctx = await getRequestContext()
    const aiSettings = await getAISettings()

    // Rate limit: configurable via platform settings
    const rateCheck = checkRateLimit(`ai-chat:${ctx.userId}`, {
      maxAttempts: aiSettings.rateLimitMessages,
      windowMs: aiSettings.rateLimitWindowMinutes * 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    })
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please wait a moment.', retryAfter: rateCheck.retryAfterSeconds },
        { status: 429 },
      )
    }

    let body: { message: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawMessage = typeof body.message === 'string'
      ? body.message.replace(/<[^>]*>/g, '').trim().slice(0, 4000)
      : ''

    if (!rawMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const isInit = rawMessage === '__INIT__'
    const db = await getDb()

    // Load existing contacts to check if this is a returning user
    const existingContacts = await loadExistingContacts(ctx.userId, ctx.campaignId)
    const isReturningUser = existingContacts.length > 0

    // Load volunteer's workflow mode (voter-contact vs fundraising)
    const { rows: membershipRows } = await db.query(
      `SELECT settings FROM memberships WHERE user_id = $1 AND campaign_id = $2 LIMIT 1`,
      [ctx.userId, ctx.campaignId],
    )
    const membershipSettings = (membershipRows[0]?.settings || {}) as Record<string, unknown>
    const workflowMode = (membershipSettings.workflowMode as string) || null
    const activeFundraiserTypeId = (membershipSettings.activeFundraiserTypeId as string) || null

    // Check if fundraising branching is enabled for this campaign
    const campaignConfig = await getCampaignConfig(ctx.campaignId)
    const fundraisingEnabled = isFundraisingEnabled(campaignConfig.aiContext)
    const fundraiserTypes = campaignConfig.aiContext?.fundraisingConfig?.fundraiserTypes || []

    // Detect upcoming fundraiser events this volunteer has RSVP'd to
    let upcomingFundraiserEvents: { title: string; typeId: string; typeName: string }[] = []
    if (fundraisingEnabled && !activeFundraiserTypeId && fundraiserTypes.length > 0) {
      try {
        const { rows: rsvpEvents } = await db.query(`
          SELECT e.title, e.fundraiser_type
          FROM event_rsvps er
          JOIN events e ON e.id = er.event_id
          JOIN campaigns c ON c.org_id = e.organization_id
          WHERE er.user_id = $1
            AND c.id = $2
            AND e.event_type = 'fundraiser'
            AND e.fundraiser_type IS NOT NULL
            AND e.start_time > NOW()
            AND er.status = 'going'
          ORDER BY e.start_time ASC
          LIMIT 5
        `, [ctx.userId, ctx.campaignId])

        upcomingFundraiserEvents = rsvpEvents
          .map(r => {
            const ft = fundraiserTypes.find(t => t.id === r.fundraiser_type)
            return ft ? { title: r.title, typeId: r.fundraiser_type, typeName: ft.name } : null
          })
          .filter((e): e is { title: string; typeId: string; typeName: string } => e !== null)
      } catch (err) {
        // Non-fatal: RSVP detection failing shouldn't break chat
        console.error('[ai-chat] RSVP detection error (non-fatal):', err)
      }
    }

    // Load upcoming events for the campaign's org (for contact event RSVP tracking)
    let upcomingEvents: { id: string; title: string; eventType: string; startTime: string }[] = []
    try {
      const { rows: eventRows } = await db.query(`
        SELECT e.id, e.title, e.event_type, e.start_time
        FROM events e
        JOIN campaigns c ON c.org_id = e.organization_id
        WHERE c.id = $1 AND e.status = 'published' AND e.start_time > NOW()
        ORDER BY e.start_time ASC
        LIMIT 5
      `, [ctx.campaignId])
      upcomingEvents = eventRows.map(r => ({
        id: r.id,
        title: r.title,
        eventType: r.event_type,
        startTime: r.start_time,
      }))
    } catch (err) {
      console.error('[ai-chat] Upcoming events load error (non-fatal):', err)
    }

    let message: string
    if (!isInit) {
      message = rawMessage
    } else if (isReturningUser) {
      // Returning user with existing contacts — pick up where they left off
      const uncontacted = existingContacts.filter(c => !c.contacted).length
      const unmatched = existingContacts.filter(c => c.matchStatus === 'pending').length
      const contacted = existingContacts.filter(c => c.contacted).length
      // Figure out which categories they've covered
      const coveredCategories = new Set(existingContacts.map(c => c.category))
      const allCatIds = ['household', 'close-family', 'close-friends', 'neighbors', 'coworkers', 'faith-community', 'school-parents', 'social-clubs', 'local-business', 'political', 'online-friends', 'service-providers', 'former-connections', 'who-did-we-miss']
      const uncoveredCategories = allCatIds.filter(id => !coveredCategories.has(id))

      if (fundraisingEnabled && !workflowMode) {
        // Returning user, fundraising enabled, but they never chose a mode
        message = `[System: The volunteer is returning — they already have ${existingContacts.length} people on their list but haven't chosen a workflow yet.

Welcome them back by name. Be brief — just one sentence of welcome.

Then ask the BRANCHING QUESTION: are they here to have conversations with voters, or are they working on fundraising (like hosting a get-together or asking people to pitch in)? Wait for their answer before proceeding. Do NOT use markdown formatting. Do NOT describe your process.]`
      } else if (workflowMode === 'fundraising') {
        // Returning user in fundraising mode
        message = `[System: The volunteer is returning in FUNDRAISING mode. Welcome them back by name. Be brief — just one sentence of welcome.

Then get right back to fundraising coaching. Ask them what they've been working on — have they made any asks? Hosted or planned any events? Help them pick up where they left off. Do NOT use markdown formatting. Do NOT describe your process.]`
      } else {
        // Returning user in voter-contact mode (or no fundraising enabled — existing behavior)
        message = `[System: The volunteer is returning — they already have ${existingContacts.length} people on their list. ${contacted > 0 ? `They've had ${contacted} conversations so far.` : ''} ${unmatched > 0 ? `${unmatched} contacts still need matching.` : ''} ${uncontacted > 0 ? `${uncontacted} people haven't been contacted yet.` : ''}

Welcome them back by name. Be brief — just one sentence of welcome.

Then get RIGHT back to work. Based on their current state, pick the highest-impact next step:
${existingContacts.length < 25 ? `- They only have ${existingContacts.length} contacts. Push to add more.${uncoveredCategories.length > 0 ? ` They haven't covered these categories yet: ${uncoveredCategories.slice(0, 4).join(', ')}. Ask about one of those with a specific, direct question.` : ''}` : ''}
${unmatched > 5 ? `- ${unmatched} contacts are unmatched. Run matching and start confirming.` : ''}
${uncontacted > 0 && existingContacts.length >= 15 ? `- ${uncontacted} people haven't been contacted. Suggest they reach out to someone.` : ''}
${contacted > 0 && existingContacts.length >= 25 ? '- They have momentum. Suggest their next conversation or ask them to add more people from an uncovered category.' : ''}

Ask ONE specific question to get them going immediately. Don't recap everything — they know what this is. Do NOT use markdown formatting. Do NOT describe your process.]`
      }
    } else if (fundraisingEnabled) {
      // Brand new user, fundraising-enabled campaign — ask branching question instead of residency
      message = '[System: The volunteer just opened the chat for the first time. Greet them by name. In 1-2 sentences: mention the campaign name and that you\'re here to help. Then ask the BRANCHING QUESTION: are they here to have conversations with voters, or are they working on fundraising — like hosting a get-together or asking people to pitch in? Keep it natural and conversational. Do NOT ask about residency yet — wait until they answer the branching question. Do NOT use markdown formatting (no ** or * or headers). Do NOT describe your own process or tone. Just do it.]'
    } else {
      // Brand new user, normal campaign — first time (existing behavior)
      message = '[System: The volunteer just opened the chat for the first time. Greet them by name. In 2-3 sentences: mention the campaign name, tell them you\'re going to help them build a list of people they know who live in the state/district, match them to the voter file, and coach conversations. Say the state or district name explicitly. Then ask your FIRST question: whether the volunteer themselves lives in the state/district. This is critical — you need to know before you start list-building. Do NOT jump straight to "who do you live with?" Vary your opening naturally. Do NOT use markdown formatting (no ** or * or headers). Do NOT describe your own process or tone. Do NOT say "let\'s move fast" or "I\'ll keep this quick." Just do it.]'
    }

    // Load chat history (most recent 50 messages, in chronological order)
    const { rows: historyRows } = await db.query(
      `SELECT role, content, tool_calls, tool_results FROM (
        SELECT * FROM chat_messages
        WHERE user_id = $1 AND campaign_id = $2
        ORDER BY created_at DESC
        LIMIT 50
      ) sub ORDER BY created_at ASC`,
      [ctx.userId, ctx.campaignId],
    )

    const history: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }> = []
    for (const row of historyRows) {
      if (row.role === 'assistant' && row.tool_calls) {
        // Reconstruct assistant message with tool_use blocks so the AI
        // remembers what tools it called in previous sessions
        const toolCalls = typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls
        const contentBlocks: Array<Record<string, unknown>> = []
        if (row.content) {
          contentBlocks.push({ type: 'text', text: row.content })
        }
        for (const tc of toolCalls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id || `tool_${crypto.randomUUID()}`,
            name: tc.name,
            input: tc.input || {},
          })
        }
        history.push({ role: 'assistant', content: contentBlocks })

        // Inject the corresponding tool_results as a synthetic user message
        // (Anthropic requires tool_result to follow tool_use)
        const toolResults = row.tool_results
          ? (typeof row.tool_results === 'string' ? JSON.parse(row.tool_results) : row.tool_results)
          : []
        if (toolResults.length > 0) {
          const resultBlocks = toolCalls.map((tc: Record<string, unknown>, i: number) => ({
            type: 'tool_result',
            tool_use_id: tc.id || contentBlocks.find(b => b.name === tc.name && b.type === 'tool_use')?.id || `tool_${crypto.randomUUID()}`,
            content: JSON.stringify(toolResults[i]?.result ?? toolResults[i] ?? {}),
          }))
          history.push({ role: 'user', content: resultBlocks })
        }
      } else {
        history.push({
          role: row.role as 'user' | 'assistant',
          content: row.content as string,
        })
      }
    }

    // Save user message to DB (skip for __INIT__ sentinel)
    if (!isInit) {
      await db.query(
        `INSERT INTO chat_messages (id, user_id, campaign_id, role, content)
         VALUES ($1, $2, $3, 'user', $4)`,
        [crypto.randomUUID(), ctx.userId, ctx.campaignId, rawMessage],
      )
    }

    // Stream the AI response
    const encoder = new TextEncoder()
    let fullAssistantText = ''
    const allToolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
    const allToolResults: Array<{ id: string; name: string; result: Record<string, unknown> }> = []

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamChat({
            userId: ctx.userId,
            campaignId: ctx.campaignId,
            message,
            history,
            existingContacts,
            volunteerWorkflowMode: workflowMode,
            activeFundraiserTypeId,
            upcomingFundraiserEvents,
            upcomingEvents,
          })) {
            if (event.type === 'text') {
              fullAssistantText += event.text as string
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'tool_result') {
              allToolCalls.push({ id: event.id as string, name: event.name as string, input: event.input as Record<string, unknown> })
              allToolResults.push({ id: event.id as string, name: event.name as string, result: event.result as Record<string, unknown> })
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'error') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'done') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            }
          }

          // Save assistant message to DB
          if (fullAssistantText) {
            await db.query(
              `INSERT INTO chat_messages (id, user_id, campaign_id, role, content, tool_calls, tool_results)
               VALUES ($1, $2, $3, 'assistant', $4, $5, $6)`,
              [
                crypto.randomUUID(),
                ctx.userId,
                ctx.campaignId,
                fullAssistantText,
                allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null,
                allToolResults.length > 0 ? JSON.stringify(allToolResults) : null,
              ],
            )
          }
        } catch (err) {
          console.error('[ai/chat] Stream error:', err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'An error occurred. Please try again.' })}\n\n`,
          ))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[ai/chat] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
