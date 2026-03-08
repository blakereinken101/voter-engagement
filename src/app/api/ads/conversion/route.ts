import { NextRequest, NextResponse } from 'next/server'

/**
 * Google Ads Offline Conversion Tracking
 *
 * Reports demo bookings as conversions to Google Ads via the API.
 * This supplements the client-side gtag conversion tracking as a
 * server-side backup to ensure no conversions are missed.
 *
 * Called internally after a demo is booked (not exposed publicly).
 */

const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID
const GOOGLE_ADS_CONVERSION_ACTION_ID = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET

async function getAccessToken(): Promise<string | null> {
  if (!GOOGLE_ADS_REFRESH_TOKEN || !GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
    return null
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      client_id: GOOGLE_ADS_CLIENT_ID,
      client_secret: GOOGLE_ADS_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()
  return data.access_token || null
}

export async function POST(request: NextRequest) {
  // Only allow internal calls (check for internal header or secret)
  const internalSecret = request.headers.get('x-internal-secret')
  if (internalSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GOOGLE_ADS_CUSTOMER_ID || !GOOGLE_ADS_CONVERSION_ACTION_ID || !GOOGLE_ADS_DEVELOPER_TOKEN) {
    // Google Ads not configured — skip silently
    return NextResponse.json({ skipped: true, reason: 'Google Ads not configured' })
  }

  try {
    const body = await request.json()
    const { gclid, email, conversionDateTime, conversionValue } = body

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 })
    }

    const customerId = GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '')
    const conversionActionResource = `customers/${customerId}/conversionActions/${GOOGLE_ADS_CONVERSION_ACTION_ID}`

    // Build the conversion upload
    const conversion: Record<string, unknown> = {
      conversion_action: conversionActionResource,
      conversion_date_time: conversionDateTime || new Date().toISOString().replace('T', ' ').replace('Z', '+00:00'),
      conversion_value: conversionValue || 100, // Default value per demo booking
      currency_code: 'USD',
    }

    // Use GCLID if available (best tracking), otherwise use enhanced conversions with email
    if (gclid) {
      conversion.gclid = gclid
    } else if (email) {
      // Enhanced conversions — hash the email for privacy
      const encoder = new TextEncoder()
      const data = encoder.encode(email.trim().toLowerCase())
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashedEmail = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      conversion.user_identifiers = [
        { hashed_email: hashedEmail }
      ]
    }

    const uploadRes = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversions: [conversion],
          partial_failure: true,
        }),
      }
    )

    const result = await uploadRes.json()

    if (!uploadRes.ok) {
      console.error('[ads/conversion] Upload failed:', JSON.stringify(result))
      return NextResponse.json({ error: 'Conversion upload failed', details: result }, { status: 500 })
    }

    console.log('[ads/conversion] Conversion uploaded successfully')
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[ads/conversion] Error:', error)
    return NextResponse.json({ error: 'Failed to upload conversion' }, { status: 500 })
  }
}
