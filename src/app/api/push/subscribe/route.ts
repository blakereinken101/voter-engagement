import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSessionFromRequest, getActiveCampaignId } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { subscription, deviceToken, platform = 'web' } = body

    if (platform === 'ios') {
      if (!deviceToken) {
        return NextResponse.json({ error: 'deviceToken is required for iOS' }, { status: 400 })
      }
    } else {
      if (!subscription || !subscription.endpoint) {
        return NextResponse.json({ error: 'subscription is required' }, { status: 400 })
      }
    }

    const pool = getPool()
    const campaignId = getActiveCampaignId()

    if (platform === 'ios') {
      // Remove existing subscription with this token for this user, then insert fresh
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND platform = 'ios' AND device_token = $2`,
        [session.userId, deviceToken]
      )
      const id = crypto.randomUUID()
      await pool.query(
        `INSERT INTO push_subscriptions (id, user_id, platform, device_token, campaign_id)
         VALUES ($1, $2, 'ios', $3, $4)`,
        [id, session.userId, deviceToken, campaignId]
      )
    } else {
      // Web push: remove existing subscription with same endpoint, insert new
      const subscriptionJson = JSON.stringify(subscription)

      const { rows: existing } = await pool.query(
        `SELECT id, subscription FROM push_subscriptions WHERE user_id = $1 AND platform = 'web'`,
        [session.userId]
      )
      for (const row of existing) {
        try {
          const sub = JSON.parse(row.subscription as string)
          if (sub.endpoint === subscription.endpoint) {
            await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [row.id])
          }
        } catch { /* skip malformed rows */ }
      }

      const id = crypto.randomUUID()
      await pool.query(
        `INSERT INTO push_subscriptions (id, user_id, platform, subscription, campaign_id)
         VALUES ($1, $2, 'web', $3, $4)`,
        [id, session.userId, subscriptionJson, campaignId]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[push/subscribe] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
