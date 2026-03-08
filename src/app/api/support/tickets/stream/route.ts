import { getSupportContext } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { registerSupportClient } from '@/lib/support-realtime'
import { ADMIN_ROLES } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/support/tickets/stream — SSE endpoint for real-time ticket updates */
export async function GET() {
  try {
    const ctx = await getSupportContext()
    const isAdmin = ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role)

    let cleanup: (() => void) | null = null

    const stream = new ReadableStream({
      start(controller) {
        cleanup = registerSupportClient(ctx.userId, controller, ctx.campaignId, isAdmin)

        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ userId: ctx.userId, isAdmin })}\n\n`
        ))

        // Keep-alive every 30 seconds
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            clearInterval(keepAlive)
          }
        }, 30000)
      },
      cancel() {
        if (cleanup) cleanup()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
