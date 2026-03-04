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

    // Parallelize independent DB queries for speed
    const [existingContacts, membershipResult, campaignConfig, upcomingEventsResult] = await Promise.all([
      loadExistingContacts(ctx.userId, ctx.campaignId),
      db.query(
        `SELECT settings FROM memberships WHERE user_id = $1 AND campaign_id = $2 LIMIT 1`,
        [ctx.userId, ctx.campaignId],
      ),
      getCampaignConfig(ctx.campaignId),
      db.query(`
        SELECT e.id, e.title, e.event_type, e.start_time
        FROM events e
        JOIN campaigns c ON c.org_id = e.organization_id
        WHERE c.id = $1 AND e.status = 'published' AND e.start_time > NOW()
        ORDER BY e.start_time ASC
        LIMIT 5
      `, [ctx.campaignId]).catch(err => {
        console.error('[ai-chat] Upcoming events load error (non-fatal):', err)
        return { rows: [] }
      }),
    ])

    const isReturningUser = existingContacts.length > 0

    const membershipSettings = (membershipResult.rows[0]?.settings || {}) as Record<string, unknown>
    let workflowMode = (membershipSettings.workflowMode as string) || null
    let activeFundraiserTypeId = (membershipSettings.activeFundraiserTypeId as string) || null

    const fundraisingEnabled = isFundraisingEnabled(campaignConfig.aiContext)
    const fundraiserTypes = campaignConfig.aiContext?.fundraisingConfig?.fundraiserTypes || []

    // Clear stale fundraising workflow if fundraising is no longer a campaign priority
    if (workflowMode === 'fundraising' && !fundraisingEnabled) {
      console.warn(`[ai-chat] Clearing stale fundraising workflowMode for user=${ctx.userId} campaign=${ctx.campaignId}`)
      workflowMode = null
      activeFundraiserTypeId = null
      // Async DB cleanup so future requests don't re-clear
      db.query(
        `UPDATE memberships
         SET settings = COALESCE(settings, '{}'::jsonb) - 'workflowMode' - 'activeFundraiserTypeId'
         WHERE user_id = $1 AND campaign_id = $2`,
        [ctx.userId, ctx.campaignId],
      ).catch(err => {
        console.error('[ai-chat] Failed to clear stale workflow settings (non-fatal):', err)
      })
    }

    const upcomingEvents = upcomingEventsResult.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      title: r.title as string,
      eventType: r.event_type as string,
      startTime: r.start_time as string,
    }))

    // Detect upcoming fundraiser events (depends on campaignConfig, so runs after parallel batch)
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
          .map((r: Record<string, unknown>) => {
            const ft = fundraiserTypes.find(t => t.id === r.fundraiser_type)
            return ft ? { title: r.title as string, typeId: r.fundraiser_type as string, typeName: ft.name } : null
          })
          .filter((e: unknown): e is { title: string; typeId: string; typeName: string } => e !== null)
      } catch (err) {
        // Non-fatal: RSVP detection failing shouldn't break chat
        console.error('[ai-chat] RSVP detection error (non-fatal):', err)
      }
    }

    // For __INIT__, pass a silent signal. The AI's behavior is dictated
    // entirely by the system prompt (managed via Admin UI DB prompts).
    // No behavioral instructions here — that was causing the AI to
    // override Admin UI prompts with hardcoded onboarding logic.
    const message = isInit ? '(Conversation started)' : rawMessage

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

    // Guard: if __INIT__ arrives but conversation already exists, don't
    // re-trigger the AI greeting — that would signal "start over" to the model.
    if (isInit && historyRows.length > 0) {
      return new Response(
        new TextEncoder().encode('data: [DONE]\n\n'),
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } },
      )
    }

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
        let closed = false
        const safeEnqueue = (chunk: Uint8Array) => {
          if (!closed) {
            try { controller.enqueue(chunk) } catch { closed = true }
          }
        }
        const safeClose = () => {
          if (!closed) {
            try { controller.close() } catch { /* already closed */ }
            closed = true
          }
        }

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
            campaignConfig,
          })) {
            if (event.type === 'text') {
              fullAssistantText += event.text as string
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'tool_result') {
              allToolCalls.push({ id: event.id as string, name: event.name as string, input: event.input as Record<string, unknown> })
              allToolResults.push({ id: event.id as string, name: event.name as string, result: event.result as Record<string, unknown> })
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'info') {
              // Provider fallback info — log server-side only, don't forward to client
              console.info('[ai/chat]', event.message)
            } else if (event.type === 'error') {
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } else if (event.type === 'done') {
              safeEnqueue(encoder.encode('data: [DONE]\n\n'))
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
          safeEnqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'An error occurred. Please try again.' })}\n\n`,
          ))
        } finally {
          safeClose()
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
