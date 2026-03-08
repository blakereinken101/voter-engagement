/**
 * Real-time support ticket notifications using in-memory SSE connection registry.
 * Follows the same pattern as messaging-realtime.ts.
 */
import { getPool } from '@/lib/db'
import { ADMIN_ROLES, type MembershipRole } from '@/types'

interface SupportSSEClient {
  userId: string
  controller: ReadableStreamDefaultController
  campaignId: string
  isAdmin: boolean
}

// Global registry of active SSE connections
const clients = new Map<string, Set<SupportSSEClient>>() // userId -> set of clients

/**
 * Register an SSE client for support ticket updates. Returns a cleanup function.
 */
export function registerSupportClient(
  userId: string,
  controller: ReadableStreamDefaultController,
  campaignId: string,
  isAdmin: boolean,
): () => void {
  const client: SupportSSEClient = { userId, controller, campaignId, isAdmin }

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
 * Notify relevant users about a ticket event.
 * - Ticket owner always gets notified
 * - Assigned agent gets notified
 * - All admins for the campaign get notified
 */
export async function notifyTicketEvent(
  campaignId: string,
  ticketOwnerId: string,
  assignedTo: string | null,
  event: Record<string, unknown>,
) {
  const notified = new Set<string>()

  // Notify all connected clients that should see this event
  for (const [userId, userClients] of clients) {
    for (const client of userClients) {
      if (client.campaignId !== campaignId) continue

      // Notify if: ticket owner, assigned agent, or admin
      if (userId === ticketOwnerId || userId === assignedTo || client.isAdmin) {
        if (!notified.has(userId)) {
          sendEvent(client.controller, 'ticket_update', event)
          notified.add(userId)
        }
      }
    }
  }
}

/**
 * Get count of connected support clients (for monitoring).
 */
export function getConnectedSupportCount(): number {
  let count = 0
  for (const userClients of clients.values()) {
    count += userClients.size
  }
  return count
}
