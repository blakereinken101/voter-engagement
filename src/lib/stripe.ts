import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
    })
  }
  return _stripe
}

export const STRIPE_PRICES: Record<string, string> = {
  grassroots: process.env.STRIPE_PRICE_GRASSROOTS || '',
  growth: process.env.STRIPE_PRICE_GROWTH || '',
}

// Scale tier is "Contact Us" — no self-serve checkout
