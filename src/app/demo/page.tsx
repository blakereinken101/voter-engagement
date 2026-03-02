'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, FormEvent } from 'react'
import { ArrowLeft, Video, Users, Send, CheckCircle } from 'lucide-react'
import Cal from '@calcom/embed-react'

const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || ''

export default function DemoPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    role: '',
    attendeeCount: 'Just me',
    notes: '',
  })
  const [step, setStep] = useState<'form' | 'calendar'>('form')
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'error'>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormStatus('sending')
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setStep('calendar')
    } catch {
      setFormStatus('error')
    }
  }

  return (
    <main className="min-h-screen cosmic-bg constellation flex flex-col">
      {/* Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-20 md:h-28 w-auto" priority />
          </Link>
          <Link
            href="/"
            className="text-white/60 text-sm hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto px-6 py-12 md:py-16 w-full">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-purple/10 border border-vc-purple/20 text-vc-purple-light text-sm mb-4">
            <Video className="w-4 h-4" />
            <span>Product Demo</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            See Threshold in action
          </h1>
          <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
            Book a personalized demo to see how our AI-powered relational organizing tool can help your campaign. We&rsquo;ll walk through the platform and answer any questions.
          </p>
        </div>

        {step === 'form' ? (
          /* Intake Form */
          <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 rounded-btn text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 rounded-btn text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50"
                  placeholder="you@campaign.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">Organization / Campaign</label>
              <input
                type="text"
                value={formData.organization}
                onChange={e => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                className="glass-input w-full px-4 py-2.5 rounded-btn text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50"
                placeholder="Campaign or organization name"
              />
            </div>

            <div>
              <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">I am a... *</label>
              <select
                required
                value={formData.role}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="glass-input w-full px-4 py-2.5 rounded-btn text-sm text-white focus:outline-none focus:ring-2 focus:ring-vc-purple/50 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.4)%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat"
              >
                <option value="" disabled className="bg-[#1a1a2e]">Select your role</option>
                <option value="Candidate" className="bg-[#1a1a2e]">Candidate</option>
                <option value="Campaign Staff" className="bg-[#1a1a2e]">Campaign Staff</option>
                <option value="Consultant" className="bg-[#1a1a2e]">Consultant</option>
                <option value="Party / Committee" className="bg-[#1a1a2e]">Party / Committee</option>
                <option value="Other" className="bg-[#1a1a2e]">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                How many people will join the call?
              </label>
              <select
                value={formData.attendeeCount}
                onChange={e => setFormData(prev => ({ ...prev, attendeeCount: e.target.value }))}
                className="glass-input w-full px-4 py-2.5 rounded-btn text-sm text-white focus:outline-none focus:ring-2 focus:ring-vc-purple/50 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.4)%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat"
              >
                <option value="Just me" className="bg-[#1a1a2e]">Just me</option>
                <option value="2-3 people" className="bg-[#1a1a2e]">2-3 people</option>
                <option value="4+ people" className="bg-[#1a1a2e]">4+ people</option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">Anything specific you&rsquo;d like to discuss?</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="glass-input w-full px-4 py-2.5 rounded-btn text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50 resize-none"
                placeholder="Tell us about your race, what you're looking for, or any questions you have..."
              />
            </div>

            {formStatus === 'error' && (
              <p className="text-vc-coral text-sm">Something went wrong. Please try again or email us directly at <a href="mailto:info@thresholdvote.com" className="underline">info@thresholdvote.com</a>.</p>
            )}

            <button
              type="submit"
              disabled={formStatus === 'sending'}
              className="w-full bg-vc-purple text-white font-bold font-display text-base px-8 py-3 rounded-btn transition-all hover:bg-vc-purple-light hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {formStatus === 'sending' ? (
                'Submitting...'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Continue to Pick a Time
                </>
              )}
            </button>
          </form>
        ) : CAL_LINK ? (
          /* Cal.com Booking */
          <div>
            <div className="glass-card p-4 mb-6 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-vc-teal flex-shrink-0" />
              <p className="text-white/70 text-sm">
                Thanks, {formData.name}! Now pick a time that works for you.
              </p>
            </div>
            <div className="glass-card p-2 overflow-hidden" style={{ minHeight: 500 }}>
              <Cal
                calLink={CAL_LINK}
                config={{
                  theme: 'dark' as const,
                  name: formData.name,
                  email: formData.email,
                  notes: `Role: ${formData.role}\nOrganization: ${formData.organization || 'N/A'}\nAttendees: ${formData.attendeeCount}${formData.notes ? `\nNotes: ${formData.notes}` : ''}`,
                }}
                style={{ width: '100%', height: '100%', minHeight: 500, overflow: 'auto' }}
              />
            </div>
          </div>
        ) : (
          /* Fallback if Cal.com link not configured */
          <div className="glass-card p-8 text-center">
            <CheckCircle className="w-12 h-12 text-vc-teal mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-white mb-2">Request received!</h3>
            <p className="text-white/60 mb-4">
              We&rsquo;ve got your info and will reach out shortly to schedule your demo.
            </p>
            <p className="text-white/40 text-sm">
              Or email us directly at{' '}
              <a href="mailto:info@thresholdvote.com" className="text-vc-purple-light hover:underline">
                info@thresholdvote.com
              </a>
            </p>
          </div>
        )}

        <p className="text-white/30 text-sm text-center mt-6">
          Questions? Email us at{' '}
          <a href="mailto:info@thresholdvote.com" className="text-vc-purple-light hover:underline">
            info@thresholdvote.com
          </a>
        </p>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-white/5 mt-auto">
        <p className="text-white/30 text-xs">
          &copy; {new Date().getFullYear()} Vote Threshold LLC. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-1">
          <Link href="/privacy" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Privacy Policy</Link>
          <span className="text-white/10 text-[10px]">|</span>
          <Link href="/terms" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </main>
  )
}
