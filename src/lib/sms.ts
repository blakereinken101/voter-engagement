import { Telnyx } from 'telnyx'

let _client: InstanceType<typeof Telnyx> | null = null

function getClient() {
  if (!_client) {
    const apiKey = process.env.TELNYX_API_KEY
    if (!apiKey) return null
    _client = new Telnyx({ apiKey })
  }
  return _client
}

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 * Strips non-digit characters and prepends +1 if missing.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  // Already has country code or international number
  if (phone.startsWith('+')) return phone
  return `+${digits}`
}

// ── Types ────────────────────────────────────────────────────────

export type SmsErrorCategory = 'permanent' | 'transient' | 'rate_limited'

export interface SmsResult {
  success: boolean
  errorCode?: number
  errorCategory?: SmsErrorCategory
  errorMessage?: string
}

// ── Error classification ─────────────────────────────────────────

/**
 * Telnyx error codes — mapped to the same categories as the old Twilio codes.
 * See https://developers.telnyx.com/docs/messaging/troubleshooting
 */

/** Errors that should never be retried (bad number, opt-out, etc.) */
const PERMANENT_ERROR_CODES = new Set([
  40300, // Message blocked (spam/opt-out filtering)
  40310, // Destination number invalid
  40311, // Destination number not in service
  40312, // Destination unreachable (landline)
  40400, // Number not provisioned to messaging profile
  40401, // Not capable of SMS
])

/** Errors caused by rate/volume limits — stop batch and retry later */
const RATE_LIMIT_ERROR_CODES = new Set([
  40003, // Rate limit exceeded
  42900, // Too many requests
  40350, // 10DLC throughput limit exceeded
])

function classifyProviderError(err: any): SmsErrorCategory {
  // Check structured API error codes from the response body
  const bodyCode = err?.error?.errors?.[0]?.code
  if (typeof bodyCode === 'number') {
    if (PERMANENT_ERROR_CODES.has(bodyCode)) return 'permanent'
    if (RATE_LIMIT_ERROR_CODES.has(bodyCode)) return 'rate_limited'
  }
  // Check HTTP status
  if (err?.status === 429) return 'rate_limited'
  return 'transient'
}

// ── Utilities ────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Core SMS sending ─────────────────────────────────────────────

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const client = getClient()
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!client || !messagingProfileId) {
    console.warn('[sms] Telnyx not configured, skipping SMS')
    return { success: false, errorCategory: 'permanent', errorMessage: 'Telnyx not configured' }
  }

  try {
    await client.messages.send({
      to: normalizePhone(to),
      messaging_profile_id: messagingProfileId,
      text: body,
      type: 'SMS',
    })
    return { success: true }
  } catch (err: any) {
    const errorCategory = classifyProviderError(err)
    const errorCode = err?.error?.errors?.[0]?.code || err?.status
    const errorMessage = err?.error?.errors?.[0]?.detail || err?.message || 'Unknown Telnyx error'
    console.error(`[sms] Failed to send to ${to}: code=${errorCode} category=${errorCategory} msg=${errorMessage}`)
    return { success: false, errorCode, errorCategory, errorMessage }
  }
}

// ── Message formatters ───────────────────────────────────────────

export function formatEventReminderSms(
  eventTitle: string,
  startTime: string,
  timezone: string | undefined,
  reminderType: '24h' | '6h',
  slug: string,
): string {
  const d = new Date(startTime)
  const timeStr = d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || 'America/New_York',
  })
  const timeLabel = reminderType === '24h' ? 'tomorrow' : 'in 6 hours'
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://thresholdvote.com'
  return `Reminder: ${eventTitle} starts ${timeLabel} (${timeStr})!\n\nDetails: ${appUrl}/events/${slug}\n\nReply STOP to unsubscribe`
}

export function formatEventBlastSms(
  hostName: string,
  eventTitle: string,
  message: string,
  slug: string,
): string {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://thresholdvote.com'
  return `The host of ${eventTitle} sent a message:\n\n"${message}"\n\nDetails: ${appUrl}/events/${slug}\n\nReply STOP to unsubscribe`
}
