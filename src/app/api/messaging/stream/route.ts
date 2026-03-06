import { getPool } from '@/lib/db'
import { getMessagingContext } from '@/lib/messaging'
import { handleAuthError } from '@/lib/auth'
import { registerClient } from '@/lib/messaging-realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/messaging/stream — SSE endpoint for real-time message delivery */
export async function GET() {
  try {
    const ctx = await getMessagingContext()
    const pool = getPool()

    // Get all channels this user belongs to
    const { rows } = await pool.query(
      `SELECT c.id FROM messaging_channels c
       JOIN messaging_channel_members cm ON cm.channel_id = c.id AND cm.user_id = $1
       WHERE c.campaign_id = $2 AND c.is_archived = false`,
      [ctx.userId, ctx.campaignId]
    )
    const channelIds = rows.map(r => r.id)

    let cleanup: (() => void) | null = null

    const stream = new ReadableStream({
      start(controller) {
        // Register this client for real-time events
        cleanup = registerClient(ctx.userId, controller, channelIds)

        // Send initial heartbeat
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId: ctx.userId, channels: channelIds.length })}\n\n`))

        // Keep-alive every 30 seconds
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            clearInterval(keepAlive)
          }
        }, 30000)

        // Cleanup on close
        const originalCancel = controller.close.bind(controller)
        void originalCancel // reference to prevent unused warning
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
