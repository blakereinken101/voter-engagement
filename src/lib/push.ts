import webpush from 'web-push'
import { getPool } from '@/lib/db'
import fs from 'fs'

// ── Types ────────────────────────────────────────────────────────

export interface PushPayload {
  title: string
  body: string
  url?: string
  data?: Record<string, string>
}

interface PushResult {
  sent: number
  failed: number
}

// ── Web Push (VAPID) ─────────────────────────────────────────────

let webPushConfigured = false

function ensureWebPush(): boolean {
  if (webPushConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || process.env.RESEND_FROM_EMAIL
  if (!publicKey || !privateKey || !email) return false
  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey)
  webPushConfigured = true
  return true
}

// ── APNs (iOS) ───────────────────────────────────────────────────

let apnsClient: any = null

async function getApnsClient() {
  if (apnsClient) return apnsClient
  const keyBase64 = process.env.APNS_KEY_BASE64
  const keyPath = process.env.APNS_KEY_PATH
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  if ((!keyBase64 && !keyPath) || !keyId || !teamId) return null

  let signingKey: Buffer
  if (keyBase64) {
    signingKey = Buffer.from(keyBase64, 'base64')
  } else if (keyPath && fs.existsSync(keyPath)) {
    signingKey = fs.readFileSync(keyPath)
  } else {
    console.warn('[push] APNs key not found (no APNS_KEY_BASE64 or valid APNS_KEY_PATH)')
    return null
  }

  try {
    const { ApnsClient } = await import('apns2')
    apnsClient = new ApnsClient({
      team: teamId,
      keyId,
      signingKey,
      defaultTopic: process.env.APNS_TOPIC || 'com.thresholdvote.app',
      host: process.env.NODE_ENV === 'production'
        ? 'api.push.apple.com'
        : 'api.sandbox.push.apple.com',
    })
    return apnsClient
  } catch (err) {
    console.error('[push] Failed to initialize APNs client:', err)
    return null
  }
}

// ── Cleanup helpers ──────────────────────────────────────────────

function isExpiredSubscription(err: any): boolean {
  // Web Push: 410 Gone means the subscription is no longer valid
  if (err?.statusCode === 410) return true
  // APNs: BadDeviceToken or Unregistered
  const reason = err?.reason || err?.body?.reason
  if (reason === 'BadDeviceToken' || reason === 'Unregistered') return true
  return false
}

// ── Send to specific users ───────────────────────────────────────

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<PushResult> {
  if (userIds.length === 0) return { sent: 0, failed: 0 }

  const pool = getPool()
  let sent = 0
  let failed = 0

  const { rows } = await pool.query(
    `SELECT id, user_id, platform, subscription, device_token
     FROM push_subscriptions
     WHERE user_id = ANY($1)`,
    [userIds]
  )

  if (rows.length === 0) return { sent: 0, failed: 0 }

  const webReady = ensureWebPush()

  for (const row of rows) {
    try {
      if (row.platform === 'web' && row.subscription && webReady) {
        await webpush.sendNotification(
          JSON.parse(row.subscription),
          JSON.stringify(payload)
        )
        sent++
      } else if (row.platform === 'ios' && row.device_token) {
        const client = await getApnsClient()
        if (client) {
          const { Notification } = await import('apns2')
          const notification = new Notification(row.device_token, {
            alert: { title: payload.title, body: payload.body },
            data: { url: payload.url || '/dashboard', ...(payload.data || {}) },
          })
          await client.send(notification)
          sent++
        }
      }
    } catch (err: any) {
      console.error(`[push] Failed to send to ${row.platform}/${row.id}:`, err?.message || err)
      failed++
      // Remove invalid subscriptions
      if (isExpiredSubscription(err)) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]).catch(() => {})
      }
    }
  }

  return { sent, failed }
}

// ── Send to all users in a campaign ──────────────────────────────

export async function sendPushToCampaign(
  campaignId: string,
  payload: PushPayload
): Promise<PushResult> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT DISTINCT ps.user_id
     FROM push_subscriptions ps
     JOIN memberships m ON m.user_id = ps.user_id
     WHERE m.campaign_id = $1 AND m.is_active = true`,
    [campaignId]
  )
  const userIds = rows.map((r: any) => r.user_id)
  return sendPushToUsers(userIds, payload)
}
