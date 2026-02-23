// Reserved slugs that cannot be used as organization vanity URLs.
// These correspond to existing application routes at the root level.
export const RESERVED_SLUGS = [
  'events', 'dashboard', 'sign-in', 'sign-up', 'privacy',
  'api', '_next', 'action-plan', 'matching', 'questionnaire',
  'results', 'rolodex', 'invite', 'verify-code',
  'forgot-password', 'reset-password', 'change-password',
  'favicon', 'logo', 'sw',
]

/**
 * Sanitize a string into a URL-friendly slug.
 * Lowercase, keep alphanumeric + hyphens, collapse hyphens, max 50 chars.
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/**
 * Validate a slug for format, length, and reserved words.
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length < 3) {
    return { valid: false, error: 'URL must be at least 3 characters' }
  }
  if (slug.length > 50) {
    return { valid: false, error: 'URL must be 50 characters or fewer' }
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
    return { valid: false, error: 'URL can only contain lowercase letters, numbers, and hyphens' }
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return { valid: false, error: 'This URL is reserved. Please choose a different one.' }
  }
  return { valid: true }
}
