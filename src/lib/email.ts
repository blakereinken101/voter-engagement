import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set')
    _resend = new Resend(apiKey)
  }
  return _resend
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const { error } = await getResend().emails.send({
    from: `Threshold <${FROM_EMAIL}>`,
    to: email,
    subject: `${code} is your Threshold verification code`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a2e; margin: 0 0 8px;">Sign-in verification</h2>
        <p style="color: #666; margin: 0 0 24px; font-size: 15px;">Enter this code to complete your sign-in:</p>
        <div style="background: #f5f5ff; border: 2px solid #7c3aed; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #7c3aed; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #999; font-size: 13px; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Failed to send verification code:', error)
    throw new Error('Failed to send verification email')
  }
}

export async function sendPasswordResetCode(email: string, code: string): Promise<void> {
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const { error } = await getResend().emails.send({
    from: `Threshold <${FROM_EMAIL}>`,
    to: email,
    subject: `${code} is your Threshold password reset code`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a2e; margin: 0 0 8px;">Password reset</h2>
        <p style="color: #666; margin: 0 0 24px; font-size: 15px;">Enter this code to reset your password:</p>
        <div style="background: #f5f5ff; border: 2px solid #7c3aed; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #7c3aed; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #999; font-size: 13px; margin: 0;">This code expires in 10 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Failed to send password reset code:', error)
    throw new Error('Failed to send password reset email')
  }
}

interface ContactFormData {
  name: string
  email: string
  organization?: string
  message: string
}

export async function sendContactFormEmail(data: ContactFormData): Promise<void> {
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const TO_EMAIL = 'info@votethreshold.com'

  const { error } = await getResend().emails.send({
    from: `Threshold Contact Form <${FROM_EMAIL}>`,
    to: TO_EMAIL,
    replyTo: data.email,
    subject: `New contact form submission from ${data.name}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a2e; margin: 0 0 20px;">New Contact Form Submission</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 12px; color: #666; font-size: 13px; font-weight: bold; vertical-align: top; width: 120px;">Name</td>
            <td style="padding: 8px 12px; color: #1a1a2e; font-size: 15px;">${escapeHtml(data.name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; color: #666; font-size: 13px; font-weight: bold; vertical-align: top;">Email</td>
            <td style="padding: 8px 12px; color: #1a1a2e; font-size: 15px;"><a href="mailto:${escapeHtml(data.email)}" style="color: #7c3aed;">${escapeHtml(data.email)}</a></td>
          </tr>
          ${data.organization ? `
          <tr>
            <td style="padding: 8px 12px; color: #666; font-size: 13px; font-weight: bold; vertical-align: top;">Organization</td>
            <td style="padding: 8px 12px; color: #1a1a2e; font-size: 15px;">${escapeHtml(data.organization)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 12px; color: #666; font-size: 13px; font-weight: bold; vertical-align: top;">Message</td>
            <td style="padding: 8px 12px; color: #1a1a2e; font-size: 15px; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
          </tr>
        </table>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Failed to send contact form email:', error)
    throw new Error('Failed to send contact form email')
  }
}

// ── Event Published Confirmation ─────────────────────────────────

interface PublishedEventInfo {
  title: string
  startTime: string
  timezone?: string
  locationName?: string | null
  locationCity?: string | null
  isVirtual?: boolean
  slug: string
}

export async function sendEventPublishedConfirmation(
  email: string,
  hostName: string | null,
  event: PublishedEventInfo,
): Promise<void> {
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://thresholdvote.com'
  const eventUrl = `${appUrl}/events/${event.slug}`
  const d = new Date(event.startTime)
  const formattedTime = d.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: event.timezone || 'America/New_York',
  })
  const greeting = hostName ? `Hi ${escapeHtml(hostName)},` : 'Hi there,'
  const locationLine = event.isVirtual
    ? 'Virtual event'
    : [event.locationName, event.locationCity].filter(Boolean).join(', ') || ''

  const { error } = await getResend().emails.send({
    from: `Threshold Events <${FROM_EMAIL}>`,
    to: email,
    subject: `Your event "${event.title}" is live!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <p style="color: #666; margin: 0 0 16px; font-size: 15px;">${greeting}</p>
        <h2 style="color: #1a1a2e; margin: 0 0 8px;">Your event is published!</h2>
        <p style="color: #666; margin: 0 0 20px; font-size: 15px;">Share the link below to start getting RSVPs.</p>

        <div style="background: #f5f5ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #1a1a2e; margin: 0 0 8px; font-size: 18px;">${escapeHtml(event.title)}</h3>
          <p style="color: #7c3aed; font-size: 14px; margin: 0 0 8px; font-weight: 600;">${escapeHtml(formattedTime)}</p>
          ${locationLine ? `<p style="color: #666; font-size: 14px; margin: 0;">${escapeHtml(locationLine)}</p>` : ''}
        </div>

        <a href="${eventUrl}" style="display: inline-block; background: #7c3aed; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View Your Event</a>

        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="color: #1a1a2e; font-size: 13px; font-weight: 600; margin: 0 0 4px;">Share this link:</p>
          <p style="color: #7c3aed; font-size: 13px; margin: 0; word-break: break-all;">${eventUrl}</p>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 24px;">You'll receive reminders 24 hours and 6 hours before the event.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Failed to send event published confirmation:', error)
    // Don't throw — this is a nice-to-have, not critical
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ── Event Reminder Emails ──────────────────────────────────────────

function formatEventTime(dateStr: string, timezone?: string): string {
  const d = new Date(dateStr)
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || 'America/New_York',
  }
  return d.toLocaleString('en-US', opts)
}

interface ReminderEventInfo {
  title: string
  startTime: string
  endTime?: string | null
  timezone?: string
  locationName?: string | null
  locationAddress?: string | null
  locationCity?: string | null
  locationState?: string | null
  isVirtual?: boolean
  virtualUrl?: string | null
  slug: string
}

function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://thresholdvote.com'
}

function buildLocationHtml(event: ReminderEventInfo): string {
  if (event.isVirtual) {
    const linkHtml = event.virtualUrl
      ? `<a href="${escapeHtml(event.virtualUrl)}" style="color: #7c3aed; text-decoration: none;">Join virtual event</a>`
      : 'Virtual event'
    return `<p style="color: #666; font-size: 14px; margin: 0;">${linkHtml}</p>`
  }
  const parts = [event.locationName, event.locationAddress, event.locationCity, event.locationState].filter(Boolean)
  if (parts.length === 0) return ''
  return `<p style="color: #666; font-size: 14px; margin: 0;">${escapeHtml(parts.join(', '))}</p>`
}

export async function sendEventReminderToHost(
  email: string,
  event: ReminderEventInfo,
  reminderType: '24h' | '6h',
  rsvpCounts: { going: number; maybe: number }
): Promise<void> {
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const appUrl = getAppUrl()
  const eventUrl = `${appUrl}/events/${event.slug}`
  const timeLabel = reminderType === '24h' ? 'is tomorrow' : 'is in 6 hours'
  const formattedTime = formatEventTime(event.startTime, event.timezone)

  const { error } = await getResend().emails.send({
    from: `Threshold Events <${FROM_EMAIL}>`,
    to: email,
    subject: `Your event "${event.title}" ${timeLabel}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a2e; margin: 0 0 8px;">Your event ${timeLabel}!</h2>
        <p style="color: #666; margin: 0 0 20px; font-size: 15px;">Here's a quick update on your upcoming event.</p>

        <div style="background: #f5f5ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #1a1a2e; margin: 0 0 8px; font-size: 18px;">${escapeHtml(event.title)}</h3>
          <p style="color: #7c3aed; font-size: 14px; margin: 0 0 8px; font-weight: 600;">${escapeHtml(formattedTime)}</p>
          ${buildLocationHtml(event)}
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="color: #1a1a2e; font-size: 14px; font-weight: 600; margin: 0 0 4px;">RSVP Summary</p>
          <p style="color: #666; font-size: 14px; margin: 0;">${rsvpCounts.going} going &middot; ${rsvpCounts.maybe} maybe</p>
        </div>

        <a href="${eventUrl}" style="display: inline-block; background: #7c3aed; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View Event</a>

        <p style="color: #999; font-size: 12px; margin-top: 24px;">You're receiving this because you're the host of this event on Threshold.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Failed to send host reminder:', error)
    throw new Error('Failed to send host reminder email')
  }
}

export async function sendEventReminderToGuest(
  email: string,
  event: ReminderEventInfo,
  reminderType: '24h' | '6h',
  guestName?: string | null
): Promise<void> {
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const appUrl = getAppUrl()
  const eventUrl = `${appUrl}/events/${event.slug}`
  const timeLabel = reminderType === '24h' ? 'is tomorrow' : 'is in 6 hours'
  const formattedTime = formatEventTime(event.startTime, event.timezone)
  const greeting = guestName ? `Hi ${escapeHtml(guestName)},` : 'Hi there,'

  const { error } = await getResend().emails.send({
    from: `Threshold Events <${FROM_EMAIL}>`,
    to: email,
    subject: `Reminder: "${event.title}" ${timeLabel}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <p style="color: #666; margin: 0 0 16px; font-size: 15px;">${greeting}</p>
        <h2 style="color: #1a1a2e; margin: 0 0 8px;">Your event ${timeLabel}!</h2>
        <p style="color: #666; margin: 0 0 20px; font-size: 15px;">Just a friendly heads up about an event you signed up for.</p>

        <div style="background: #f5f5ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #1a1a2e; margin: 0 0 8px; font-size: 18px;">${escapeHtml(event.title)}</h3>
          <p style="color: #7c3aed; font-size: 14px; margin: 0 0 8px; font-weight: 600;">${escapeHtml(formattedTime)}</p>
          ${buildLocationHtml(event)}
        </div>

        <a href="${eventUrl}" style="display: inline-block; background: #7c3aed; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View Event Details</a>

        <p style="color: #999; font-size: 12px; margin-top: 24px;">You're receiving this because you RSVP'd to this event on Threshold.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Failed to send guest reminder:', error)
    throw new Error('Failed to send guest reminder email')
  }
}
