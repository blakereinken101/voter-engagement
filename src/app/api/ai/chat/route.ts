import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAIEnabled, streamChat } from '@/lib/ai-chat'

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

    // Rate limit: 60 messages per 15 minutes
    const rateCheck = checkRateLimit(`ai-chat:${ctx.userId}`, {
      maxAttempts: 60,
      windowMs: 15 * 60 * 1000,
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
    const message = isInit
      ? '[System: The volunteer just opened the chat for the first time. Greet them by name, introduce yourself briefly, and get right into it. Tell them the plan: you\'re going to help them build a list of people they know, match those people to the voter file, and then coach them on conversations. Be confident and direct — not overly formal or deferential. Keep it to 3-4 sentences, then ask your first rolodex question to get started.]'
      : rawMessage

    const db = await getDb()

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
          })) {
            if (event.type === 'text') {
              fullAssistantText += event.text as string
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'tool_result') {
              allToolCalls.push({ name: event.name as string, input: event.input as Record<string, unknown> })
              allToolResults.push({ name: event.name as string, result: event.result as Record<string, unknown> })
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
