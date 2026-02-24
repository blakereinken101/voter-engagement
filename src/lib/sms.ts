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

export async function sendSms(to: string, body: string): Promise<void> {
  const client = getClient()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!client || !messagingServiceSid) {
    console.warn('[sms] Twilio not configured, skipping SMS')
    return
  }

  await client.messages.create({
    to,
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
