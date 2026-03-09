import twilio from 'twilio'

let _client: ReturnType<typeof twilio> | null = null

function getClient() {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) return null
    _client = twilio(sid, token)
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

/** Errors that should never be retried (bad number, opt-out, etc.) */
const PERMANENT_ERROR_CODES = new Set([
  21610, // Attempt to send to unsubscribed recipient
  21611, // Source number not owned
  21612, // Source number not messaging capable
  21614, // Invalid 'To' phone number
  21211, // Invalid 'To' phone number (alternate)
  30003, // Unreachable destination handset
  30005, // Unknown destination handset
  30006, // Landline or unreachable carrier
])

/** Errors caused by rate/volume limits — stop batch and retry later */
const RATE_LIMIT_ERROR_CODES = new Set([
  30034, // Message Service daily message limit reached
  30035, // Message Service concurrent message limit reached
  30022, // US A2P 10DLC throughput limit exceeded
])

function classifyTwilioError(err: any): SmsErrorCategory {
  const code = err?.code || err?.status
  if (PERMANENT_ERROR_CODES.has(code)) return 'permanent'
  if (RATE_LIMIT_ERROR_CODES.has(code)) return 'rate_limited'
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
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!client || !messagingServiceSid) {
    console.warn('[sms] Twilio not configured, skipping SMS')
    return { success: false, errorCategory: 'permanent', errorMessage: 'Twilio not configured' }
  }

  try {
    await client.messages.create({
      to: normalizePhone(to),
      messagingServiceSid,
      body,
    })
    return { success: true }
  } catch (err: any) {
    const errorCategory = classifyTwilioError(err)
    const errorCode = err?.code || err?.status
    const errorMessage = err?.message || 'Unknown Twilio error'
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
