/**
 * AI Settings — reads configuration from platform_settings table.
 * Falls back to environment variables / sensible defaults.
 * Server-only module.
 */

import { getDb } from './db'

export interface AISettings {
  provider: 'anthropic' | 'gemini'
  chatModel: string
  suggestModel: string
  maxTokens: number
  rateLimitMessages: number
  rateLimitWindowMinutes: number
  suggestRateLimit: number
}

const DEFAULTS: AISettings = {
  provider: 'anthropic',
  chatModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  suggestModel: process.env.ANTHROPIC_SUGGEST_MODEL || 'claude-haiku-4-5-20251001',
  maxTokens: 1024,
  rateLimitMessages: 60,
  rateLimitWindowMinutes: 15,
  suggestRateLimit: 30,
}

const SETTINGS_KEYS: (keyof AISettings)[] = [
  'provider', 'chatModel', 'suggestModel', 'maxTokens',
  'rateLimitMessages', 'rateLimitWindowMinutes', 'suggestRateLimit',
]

// Cache for 60 seconds to avoid hitting DB on every chat message
let cachedSettings: AISettings | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000

export async function getAISettings(): Promise<AISettings> {
  const now = Date.now()
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return cachedSettings
  }

  try {
    const db = await getDb()
    const { rows } = await db.query(
      `SELECT key, value FROM platform_settings WHERE key LIKE 'ai_%'`
    )

    const dbMap = new Map(rows.map(r => [r.key, r.value]))
    const settings: AISettings = { ...DEFAULTS }

    if (dbMap.has('ai_provider')) {
      const v = dbMap.get('ai_provider')!
      if (v === 'anthropic' || v === 'gemini') settings.provider = v
    }
    if (dbMap.has('ai_chat_model')) settings.chatModel = dbMap.get('ai_chat_model')!
    if (dbMap.has('ai_suggest_model')) settings.suggestModel = dbMap.get('ai_suggest_model')!
    if (dbMap.has('ai_max_tokens')) settings.maxTokens = parseInt(dbMap.get('ai_max_tokens')!, 10) || DEFAULTS.maxTokens
    if (dbMap.has('ai_rate_limit_messages')) settings.rateLimitMessages = parseInt(dbMap.get('ai_rate_limit_messages')!, 10) || DEFAULTS.rateLimitMessages
    if (dbMap.has('ai_rate_limit_window_minutes')) settings.rateLimitWindowMinutes = parseInt(dbMap.get('ai_rate_limit_window_minutes')!, 10) || DEFAULTS.rateLimitWindowMinutes
    if (dbMap.has('ai_suggest_rate_limit')) settings.suggestRateLimit = parseInt(dbMap.get('ai_suggest_rate_limit')!, 10) || DEFAULTS.suggestRateLimit

    cachedSettings = settings
    cacheTimestamp = now
    return settings
  } catch {
    return DEFAULTS
  }
}

export function invalidateSettingsCache() {
  cachedSettings = null
  cacheTimestamp = 0
}

/** Convert a settings key from camelCase to the db key format ai_snake_case */
function toDbKey(key: string): string {
  return 'ai_' + key.replace(/([A-Z])/g, '_$1').toLowerCase()
}

export async function updateAISettings(updates: Partial<AISettings>): Promise<AISettings> {
  const db = await getDb()

  for (const [key, value] of Object.entries(updates)) {
    if (!SETTINGS_KEYS.includes(key as keyof AISettings)) continue
    const dbKey = toDbKey(key)
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [dbKey, String(value)]
    )
  }

  invalidateSettingsCache()
  return getAISettings()
}

/** Available model options for the UI */
export const MODEL_OPTIONS = {
  anthropic: {
    chat: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', cost: '~$3/$15 per 1M tokens' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', cost: '~$0.80/$4 per 1M tokens' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', cost: '~$15/$75 per 1M tokens' },
    ],
    suggest: [
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', cost: '~$0.80/$4 per 1M tokens' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', cost: '~$3/$15 per 1M tokens' },
    ],
  },
  gemini: {
    chat: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', cost: 'Preview — free tier / pricing TBD' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', cost: '~$0.10/$0.40 per 1M tokens' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', cost: '~$0.15/$0.60 per 1M tokens' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', cost: '~$1.25/$10 per 1M tokens' },
    ],
    suggest: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', cost: 'Preview — free tier / pricing TBD' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', cost: '~$0.10/$0.40 per 1M tokens' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', cost: '~$0.15/$0.60 per 1M tokens' },
    ],
  },
}
