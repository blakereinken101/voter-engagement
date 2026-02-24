import { getPool } from '@/lib/db'

const VAN_BASE_URL = 'https://api.securevan.com/v4'

export interface VanConfig {
  apiKey: string
  mode: 0 | 1        // 0 = MyVoters, 1 = MyCampaign
  enabled: boolean
}

/**
 * Read VAN config from campaigns.settings JSONB.
 */
export async function getVanConfig(campaignId: string): Promise<VanConfig | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT settings FROM campaigns WHERE id = $1',
    [campaignId],
  )
  const vanConfig = rows[0]?.settings?.vanConfig
  if (!vanConfig?.apiKey || !vanConfig.enabled) return null
  return {
    apiKey: vanConfig.apiKey,
    mode: vanConfig.mode ?? 1,
    enabled: true,
  }
}

/**
 * Quick check if VAN is configured and enabled for a campaign.
 */
export async function isVanEnabled(campaignId: string): Promise<boolean> {
  return !!(await getVanConfig(campaignId))
}

/**
 * Make an authenticated request to the VAN API.
 */
export async function vanFetch(
  campaignId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const config = await getVanConfig(campaignId)
  if (!config) throw new Error('VAN not configured for this campaign')

  const appName = process.env.VAN_APPLICATION_NAME
  if (!appName) throw new Error('VAN_APPLICATION_NAME environment variable is not set')

  const credentials = `${appName}|${config.apiKey}|${config.mode}`
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`

  const res = await fetch(`${VAN_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let data: unknown = null
  const text = await res.text()
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  return { status: res.status, data }
}

/**
 * Log a VAN sync attempt (success or failure) to van_sync_log.
 */
export async function logVanSync(params: {
  campaignId: string
  entityType: string
  entityId: string
  vanEndpoint: string
  syncStatus: 'success' | 'failed'
  errorMessage?: string
  vanId?: number
}): Promise<void> {
  try {
    const pool = getPool()
    await pool.query(
      `INSERT INTO van_sync_log (id, campaign_id, entity_type, entity_id, van_endpoint, sync_status, error_message, van_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        params.campaignId,
        params.entityType,
        params.entityId,
        params.vanEndpoint,
        params.syncStatus,
        params.errorMessage || null,
        params.vanId || null,
      ],
    )
  } catch (err) {
    console.error('[van-client] Failed to write sync log:', err)
  }
}
