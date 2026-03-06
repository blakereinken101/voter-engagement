import { getPool } from '@/lib/db'

const PDI_BASE_URL = 'https://api.bluevote.com'

export interface PdiConfig {
  username: string
  password: string
  apiToken: string
  enabled: boolean
}

// In-memory token cache: campaignId → { token, expiresAt }
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/**
 * Read PDI config from campaigns.settings JSONB.
 */
export async function getPdiConfig(campaignId: string): Promise<PdiConfig | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT settings FROM campaigns WHERE id = $1',
    [campaignId],
  )
  const pdiConfig = rows[0]?.settings?.pdiConfig
  if (!pdiConfig?.username || !pdiConfig?.apiToken || !pdiConfig.enabled) return null
  return {
    username: pdiConfig.username,
    password: pdiConfig.password,
    apiToken: pdiConfig.apiToken,
    enabled: true,
  }
}

/**
 * Quick check if PDI is configured and enabled for a campaign.
 */
export async function isPdiEnabled(campaignId: string): Promise<boolean> {
  return !!(await getPdiConfig(campaignId))
}

/**
 * Authenticate with PDI and return a Bearer token.
 * Caches tokens in memory for 50 minutes (PDI sessions typically last 60min).
 */
async function getAccessToken(campaignId: string, config: PdiConfig): Promise<string> {
  const cached = tokenCache.get(campaignId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
  }

  const res = await fetch(`${PDI_BASE_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Username: config.username,
      Password: config.password,
      ApiToken: config.apiToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PDI authentication failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const token = data.AccessToken as string
  if (!token) throw new Error('PDI authentication returned no AccessToken')

  // Cache for 50 minutes
  tokenCache.set(campaignId, { token, expiresAt: Date.now() + 50 * 60 * 1000 })
  return token
}

/**
 * Make an authenticated request to the PDI API.
 */
export async function pdiFetch(
  campaignId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const config = await getPdiConfig(campaignId)
  if (!config) throw new Error('PDI not configured for this campaign')

  const token = await getAccessToken(campaignId, config)

  const res = await fetch(`${PDI_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // If we get a 401, clear cached token and retry once
  if (res.status === 401) {
    tokenCache.delete(campaignId)
    const freshToken = await getAccessToken(campaignId, config)
    const retry = await fetch(`${PDI_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    let retryData: unknown = null
    const retryText = await retry.text()
    try { retryData = JSON.parse(retryText) } catch { retryData = retryText }
    return { status: retry.status, data: retryData }
  }

  let data: unknown = null
  const text = await res.text()
  try { data = JSON.parse(text) } catch { data = text }

  return { status: res.status, data }
}

/**
 * Log a PDI sync attempt (success or failure) to pdi_sync_log.
 */
export async function logPdiSync(params: {
  campaignId: string
  entityType: string
  entityId: string
  pdiEndpoint: string
  syncStatus: 'success' | 'failed'
  errorMessage?: string
  pdiId?: number
}): Promise<void> {
  try {
    const pool = getPool()
    await pool.query(
      `INSERT INTO pdi_sync_log (id, campaign_id, entity_type, entity_id, pdi_endpoint, sync_status, error_message, pdi_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        params.campaignId,
        params.entityType,
        params.entityId,
        params.pdiEndpoint,
        params.syncStatus,
        params.errorMessage || null,
        params.pdiId || null,
      ],
    )
  } catch (err) {
    console.error('[pdi-client] Failed to write sync log:', err)
  }
}
