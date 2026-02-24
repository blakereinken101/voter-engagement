'use client'

import PricingCard from '@/components/events/PricingCard'
import { Sparkles, Shield, Zap, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function EventsPricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-purple/10 border border-vc-purple/20 text-vc-purple-light text-sm mb-4">
          <Sparkles className="w-4 h-4" />
          <span>Built for Progressive Organizers</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
          Events that <span className="text-gradient">win elections</span>
        </h1>
        <p className="text-white/50 max-w-2xl mx-auto text-lg">
          Shareable event pages, guest and member RSVPs, comment threads, email reminders,
          and team coordination — purpose-built for campaigns and progressive organizations, at a fraction of what legacy platforms charge.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {/* Free tier card */}
        <div className="glass-card p-6 relative transition-all hover:-translate-y-1">
          <div className="space-y-4">
            <div>
              <h3 className="font-display font-bold text-xl text-white">Free</h3>
              <p className="text-sm text-white/50 mt-1">Try it out — no credit card required</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-white">$0</span>
              <span className="text-white/50">/forever</span>
            </div>
            <Link
              href="/sign-up?product=events"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-btn font-medium text-sm text-center transition-all bg-white/10 hover:bg-white/15 text-white border border-white/15"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="border-t border-white/10 pt-4 space-y-2.5">
              {['2 published events', 'Shareable public event pages', 'Guest & member RSVPs', 'Comment threads & emoji reactions', 'Automatic email reminders'].map(feature => (
                <div key={feature} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-vc-teal shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm text-white/70">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <PricingCard plan="grassroots" />
        <PricingCard plan="growth" isPopular />
        <PricingCard plan="scale" />
      </div>

      {/* Comparison to Mobilize */}
      <div className="glass-card p-8 mb-16">
        <h2 className="font-display text-2xl font-bold text-white text-center mb-8">
          Why progressive organizations switch to Threshold Events
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-vc-teal/15 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-vc-teal" />
            </div>
            <h3 className="font-medium text-white mb-1">50-75% cheaper</h3>
            <p className="text-sm text-white/50">Start free, scale when you need to. No per-event fees, no hidden charges, no annual contracts.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-vc-purple/15 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-vc-purple-light" />
            </div>
            <h3 className="font-medium text-white mb-1">Beautiful pages</h3>
            <p className="text-sm text-white/50">Every event gets its own shareable page with cover images, countdowns, emoji reactions, and comment threads — not a spreadsheet row.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-vc-gold/15 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-vc-gold" />
            </div>
            <h3 className="font-medium text-white mb-1">Guest RSVPs</h3>
            <p className="text-sm text-white/50">No account required for public events — lower friction, more signups</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-vc-coral/15 flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-vc-coral" />
            </div>
            <h3 className="font-medium text-white mb-1">Mission-driven</h3>
            <p className="text-sm text-white/50">Built by organizers who've run campaigns, for the people still running them. Independent and mission-driven.</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-white mb-3">Ready to organize?</h2>
        <p className="text-white/50 mb-6">Create your first event in under five minutes. Start free, upgrade anytime, cancel whenever.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/events/create"
            className="inline-flex items-center justify-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white px-8 py-3 rounded-btn font-medium shadow-glow transition-all"
          >
            Start Creating Events
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/15 text-white/70 px-8 py-3 rounded-btn font-medium hover:bg-white/10 hover:text-white transition-all"
          >
            Browse Events
          </Link>
        </div>
      </div>
    </div>
  )
}
