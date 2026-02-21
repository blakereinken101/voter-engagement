import { BrandConfig } from '@/types'

/**
 * White-label branding configuration.
 * To customize for a different client, modify this file.
 * For color changes, also update tailwind.config.js vc-* values.
 */
const brandConfig: BrandConfig = {
  appName: 'VoteCircle',
  tagline: 'Your Network Is Your Most Powerful Vote',
  organizationName: 'VoteCircle',
  privacyText: 'Your data stays on your device. Names you enter are only used to match against public voter records. Nothing is stored on our servers.',
}

export default brandConfig
