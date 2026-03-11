import crypto from 'crypto'
import { getDb } from './db'

/**
 * Fire-and-forget webhook dispatcher with HMAC-SHA256 signing.
 * Looks up active webhooks for the campaign subscribed to the given event,
 * then sends POST requests to each with signed payload.
 */
export async function dispatchWebhook(
  campaignId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const db = await getDb()
    const { rows } = await db.query(
      `SELECT id, url, secret FROM webhooks
       WHERE campaign_id = $1 AND is_active = true AND $2 = ANY(events)`,
      [campaignId, event],
    )

    if (rows.length === 0) return

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    })

    for (const webhook of rows) {
      const signature = crypto
        .createHmac('sha256', webhook.secret as string)
        .update(body)
        .digest('hex')

      // Fire-and-forget — don't await
      fetch(webhook.url as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
          'X-Webhook-Id': webhook.id as string,
        },
        body,
        signal: AbortSignal.timeout(10000),
      }).catch(() => {
        // Silently ignore failed deliveries
        // In production, add to a retry queue
      })
    }
  } catch {
    // Don't let webhook failures affect the main flow
  }
}
