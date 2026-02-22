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
