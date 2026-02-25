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

export async function sendSms(to: string, body: string): Promise<void> {
  const client = getClient()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!client || !messagingServiceSid) {
    console.warn('[sms] Twilio not configured, skipping SMS')
    return
  }

  await client.messages.create({
    to: normalizePhone(to),
    messagingServiceSid,
    body,
  })
}

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
