'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import type { EventsPlan } from '@/types/events'
import { PLAN_PRICES, PLAN_LIMITS } from '@/types/events'

interface Props {
  plan: EventsPlan
  isPopular?: boolean
}

const PLAN_DETAILS: Record<EventsPlan, { name: string; description: string; features: string[] }> = {
  grassroots: {
    name: 'Grassroots',
    description: 'For local Democratic clubs and small progressive orgs',
    features: [
      'Unlimited events',
      '200 RSVPs per month',
      '3 team members',
      'Public event pages',
      'RSVP management',
      'Comment threads',
      'Email notifications',
    ],
  },
  growth: {
    name: 'Growth',
    description: 'For growing Democratic campaigns and statewide orgs',
    features: [
      'Everything in Grassroots',
      'Unlimited RSVPs',
      '10 team members',
      'Analytics dashboard',
      'Custom branding',
      'Event templates',
      'Priority email support',
    ],
  },
  scale: {
    name: 'Scale',
    description: 'For state parties, large campaigns, and progressive PACs',
    features: [
      'Everything in Growth',
      'Unlimited team members',
      'API access',
      'White-label option',
      'Priority support',
      'Custom integrations',
      'Dedicated success manager',
    ],
  },
}

export default function PricingCard({ plan, isPopular }: Props) {
  const details = PLAN_DETAILS[plan]
  const price = PLAN_PRICES[plan]

  return (
    <div className={`glass-card p-6 relative transition-all hover:-translate-y-1 ${
      isPopular ? 'ring-2 ring-vc-purple shadow-glow' : ''
    }`}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-vc-purple text-white text-xs font-bold rounded-full">
          Most Popular
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-xl text-white">{details.name}</h3>
          <p className="text-sm text-white/50 mt-1">{details.description}</p>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold text-white">${price}</span>
          <span className="text-white/50">/month</span>
        </div>

        <Link
          href="/events/create"
          className={`block w-full py-3 rounded-btn font-medium text-sm text-center transition-all ${
            isPopular
              ? 'bg-vc-purple hover:bg-vc-purple-light text-white shadow-glow'
              : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
          }`}
        >
          Start Organizing
        </Link>

        <div className="border-t border-white/10 pt-4 space-y-2.5">
          {details.features.map(feature => (
            <div key={feature} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-vc-teal shrink-0 mt-0.5" />
              <span className="text-sm text-white/70">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
