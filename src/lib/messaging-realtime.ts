/**
 * Real-time messaging fan-out using in-memory SSE connection registry.
 *
 * Each connected client registers via the SSE stream endpoint.
 * When a new message arrives, we look up which users are members of
 * the channel and push the event to their active SSE connections.
 */
import { getPool } from '@/lib/db'

interface SSEClient {
  userId: string
  controller: ReadableStreamDefaultController
  channelIds: Set<string>
}

// Global registry of active SSE connections
const clients = new Map<string, Set<SSEClient>>() // userId -> set of clients

/**
 * Register an SSE client. Returns a cleanup function.
 */
export function registerClient(userId: string, controller: ReadableStreamDefaultController, channelIds: string[]): () => void {
  const client: SSEClient = { userId, controller, channelIds: new Set(channelIds) }

  if (!clients.has(userId)) {
    clients.set(userId, new Set())
  }
  clients.get(userId)!.add(client)

  return () => {
    const userClients = clients.get(userId)
    if (userClients) {
      userClients.delete(client)
      if (userClients.size === 0) clients.delete(userId)
    }
  }
}

/**
 * Update a client's channel subscriptions (e.g., when they join a new channel).
 */
export function updateClientChannels(userId: string, channelIds: string[]) {
  const userClients = clients.get(userId)
  if (!userClients) return
  for (const client of userClients) {
    client.channelIds = new Set(channelIds)
  }
}

/**
 * Send an SSE event to a specific controller.
 */
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  try {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    controller.enqueue(new TextEncoder().encode(payload))
  } catch {
    // Client disconnected — will be cleaned up
  }
}

/**
 * Notify all SSE clients who are members of a channel about a new message.
 */
export async function notifyNewMessage(channelId: string, message: Record<string, unknown>) {
  // Get all members of this channel
  const pool = getPool()
  const { rows: members } = await pool.query(
    'SELECT user_id FROM messaging_channel_members WHERE channel_id = $1',
    [channelId]
  )

  for (const { user_id } of members) {
    const userClients = clients.get(user_id)
    if (!userClients) continue
    for (const client of userClients) {
      sendEvent(client.controller, 'new_message', message)
    }
  }
}

/**
 * Get count of connected clients (for monitoring).
 */
export function getConnectedCount(): number {
  let count = 0
  for (const userClients of clients.values()) {
    count += userClients.size
  }
  return count
}
