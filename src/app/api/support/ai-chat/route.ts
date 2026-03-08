import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { streamSupportChat } from '@/lib/support-ai'
import type { SupportChatMessage } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST /api/support/ai-chat — Stream AI support chat response */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getSupportContext()

    let body: { message: string; history: SupportChatMessage[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const message = typeof body.message === 'string'
      ? body.message.replace(/<[^>]*>/g, '').trim().slice(0, 2000)
      : ''

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const history = Array.isArray(body.history) ? body.history : []

    // Get campaign name for context
    const { getPool } = await import('@/lib/db')
    const pool = getPool()
    const { rows: campRows } = await pool.query(
      'SELECT name FROM campaigns WHERE id = $1',
      [ctx.campaignId],
    )
    const campaignName = campRows[0]?.name || 'Unknown Campaign'

    const encoder = new TextEncoder()

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
          for await (const event of streamSupportChat({
            userId: ctx.userId,
            campaignId: ctx.campaignId,
            userName: ctx.userName,
            userRole: ctx.role,
            campaignName,
            message,
            history,
          })) {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
        } catch (err) {
          console.error('[support/ai-chat] Stream error:', err)
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
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
