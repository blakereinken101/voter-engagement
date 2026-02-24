/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts. Sets up a 15-minute interval
 * to trigger event reminder emails automatically.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const CRON_SECRET = process.env.CRON_SECRET
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!CRON_SECRET) {
      console.log('[cron] CRON_SECRET not set — event reminders disabled. Set CRON_SECRET in env to enable.')
      return
    }

    // Wait 30 seconds for server to fully start before first run
    setTimeout(async () => {
      console.log('[cron] Running initial reminder check...')
      await runReminderCron(APP_URL, CRON_SECRET)
    }, 30_000)

    // Then run every 15 minutes
    setInterval(async () => {
      await runReminderCron(APP_URL, CRON_SECRET)
    }, 15 * 60 * 1000)

    console.log('[cron] Event reminder cron scheduled (every 15 minutes)')
  }
}

async function runReminderCron(appUrl: string, secret: string) {
  try {
    const res = await fetch(`${appUrl}/api/cron/reminders`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    })
    const data = await res.json()
    if (data.sent > 0) {
      console.log(`[cron] Sent ${data.sent} reminder email(s)`)
    }
  } catch (err) {
    console.error('[cron] Reminder check failed:', err)
  }
}
