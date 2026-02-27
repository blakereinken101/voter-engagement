import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAIEnabled, streamChat, loadExistingContacts } from '@/lib/ai-chat'
import { getAISettings } from '@/lib/ai-settings'

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
      message = `[System: The volunteer is returning — they already have ${existingContacts.length} people on their list. ${contacted > 0 ? `They've had ${contacted} conversations so far.` : ''} ${unmatched > 0 ? `${unmatched} contacts still need matching.` : ''} ${uncontacted > 0 ? `${uncontacted} people haven't been contacted yet.` : ''}

Welcome them back by name. Be brief — just one sentence of welcome.

Then get RIGHT back to work. Based on their current state, pick the highest-impact next step:
${existingContacts.length < 25 ? `- They only have ${existingContacts.length} contacts. Push to add more.${uncoveredCategories.length > 0 ? ` They haven't covered these categories yet: ${uncoveredCategories.slice(0, 4).join(', ')}. Ask about one of those with a specific, direct question.` : ''}` : ''}
${unmatched > 5 ? `- ${unmatched} contacts are unmatched. Run matching and start confirming.` : ''}
${uncontacted > 0 && existingContacts.length >= 15 ? `- ${uncontacted} people haven't been contacted. Suggest they reach out to someone.` : ''}
${contacted > 0 && existingContacts.length >= 25 ? '- They have momentum. Suggest their next conversation or ask them to add more people from an uncovered category.' : ''}

Ask ONE specific question to get them going immediately. Don't recap everything — they know what this is. Do NOT use markdown formatting. Do NOT describe your process.]`
    } else {
      // Brand new user — first time
      message = '[System: The volunteer just opened the chat for the first time. Greet them by name. In 2-3 sentences: mention the campaign name, tell them you\'re going to help them build a list of people they know who live in the state/district, match them to the voter file, and coach conversations. Say the state or district name explicitly. Then ask your first question — be specific and direct. Don\'t just say "who do you live with?" — say something like "Let\'s start with your household. Can you name everyone who lives with you?" Vary your opening naturally. Do NOT use markdown formatting (no ** or * or headers). Do NOT describe your own process or tone. Do NOT say "let\'s move fast" or "I\'ll keep this quick." Just do it.]'
    }

    // Load chat history (last 50 messages)
    const { rows: historyRows } = await db.query(
      `SELECT role, content FROM chat_messages
       WHERE user_id = $1 AND campaign_id = $2
       ORDER BY created_at ASC
       LIMIT 50`,
      [ctx.userId, ctx.campaignId],
    )

    const history = historyRows.map(row => ({
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
    }))

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
    const allToolCalls: Array<{ name: string; input: Record<string, unknown> }> = []
    const allToolResults: Array<{ name: string; result: Record<string, unknown> }> = []

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamChat({
            userId: ctx.userId,
            campaignId: ctx.campaignId,
            message,
            history,
            existingContacts,
          })) {
            if (event.type === 'text') {
              fullAssistantText += event.text as string
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'tool_result') {
              allToolCalls.push({ name: event.name as string, input: event.input as Record<string, unknown> })
              allToolResults.push({ name: event.name as string, result: event.result as Record<string, unknown> })
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
