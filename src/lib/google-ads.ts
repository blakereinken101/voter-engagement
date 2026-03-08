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
 * Store gclid in sessionStorage so it persists across page navigations.
 * Call this on initial page load.
 */
export function persistGclid(): void {
  const gclid = getGclid()
  if (gclid) {
    try {
      sessionStorage.setItem('gclid', gclid)
    } catch {
      // sessionStorage unavailable
    }
  }
}

/**
 * Retrieve the stored gclid (from URL or sessionStorage).
 */
export function getStoredGclid(): string | null {
  const urlGclid = getGclid()
  if (urlGclid) return urlGclid

  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem('gclid')
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
