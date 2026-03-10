/**
 * Google Ads client-side conversion tracking utilities.
 *
 * Fires gtag conversion events when users complete key actions
 * like booking a demo or submitting a contact form.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

const GCLID_KEY = 'gclid'
const GCLID_TS_KEY = 'gclid_ts'
const GCLID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

/**
 * Extract the Google Click ID (gclid) from the URL.
 * Google Ads appends this when a user clicks an ad.
 */
export function getGclid(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('gclid')
}

/**
 * Store gclid in localStorage with a timestamp for 90-day attribution.
 * Called globally from the root layout on every page load.
 */
export function persistGclid(): void {
  const gclid = getGclid()
  if (gclid) {
    try {
      localStorage.setItem(GCLID_KEY, gclid)
      localStorage.setItem(GCLID_TS_KEY, Date.now().toString())
    } catch {
      // localStorage unavailable
    }
  }
}

/**
 * Retrieve the stored gclid (from URL or localStorage).
 * Returns null if the stored gclid is older than 90 days.
 */
export function getStoredGclid(): string | null {
  const urlGclid = getGclid()
  if (urlGclid) return urlGclid

  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(GCLID_KEY)
    const ts = localStorage.getItem(GCLID_TS_KEY)
    if (!stored || !ts) return null
    if (Date.now() - Number(ts) > GCLID_MAX_AGE_MS) {
      localStorage.removeItem(GCLID_KEY)
      localStorage.removeItem(GCLID_TS_KEY)
      return null
    }
    return stored
  } catch {
    return null
  }
}

/**
 * Fire a Google Ads conversion event.
 *
 * @param conversionLabel - The conversion label from Google Ads (e.g., 'AW-XXXXXXXXX/XXXXX')
 * @param value - Optional conversion value in dollars
 */
export function trackConversion(conversionLabel: string, value?: number): void {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'conversion', {
    send_to: conversionLabel,
    value: value || 100,
    currency: 'USD',
  })
}

/**
 * Track a demo booking conversion.
 * Uses the NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL env var.
 */
export function trackDemoBooking(): void {
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
  if (label) {
    trackConversion(label, 100)
  }
}

/**
 * Track an events platform signup conversion.
 * Uses NEXT_PUBLIC_GOOGLE_ADS_EVENTS_CONVERSION_LABEL, falling back to the demo label.
 */
export function trackEventsSignup(): void {
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_EVENTS_CONVERSION_LABEL
    || process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
  if (label) {
    trackConversion(label, 35)
  }
}

/**
 * Track a contact form submission conversion.
 */
export function trackContactFormSubmit(): void {
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
  if (label) {
    trackConversion(label, 10)
  }
}
