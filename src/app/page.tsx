'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useRef, useEffect, useState, RefObject, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ArrowRight, CheckCircle, Settings, Send, Calendar, Sparkles, Shield, Globe, MessageCircle, BookUser } from 'lucide-react'

function useInView(ref: RefObject<HTMLElement | null>, options?: IntersectionObserverInit) {
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.15, ...options }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, options])

  return isInView
}

export default function LandingPage() {
  const { user, hasRelationalAccess } = useAuth()
  const eventsRef = useRef<HTMLElement>(null)
  const featuresRef = useRef<HTMLElement>(null)
  const whyRef = useRef<HTMLElement>(null)
  const contactRef = useRef<HTMLElement>(null)

  const eventsInView = useInView(eventsRef)
  const featuresInView = useInView(featuresRef)
  const whyInView = useInView(whyRef)
  const contactInView = useInView(contactRef)

  // Contact form state
  const [formData, setFormData] = useState({ name: '', email: '', organization: '', message: '' })
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to send')
      setFormStatus('sent')
      setFormData({ name: '', email: '', organization: '', message: '' })
    } catch {
      setFormStatus('error')
    }
  }

  return (
    <main className="min-h-screen flex flex-col cosmic-bg constellation">
      {/* Nav */}
      <nav className="glass-dark border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-20 md:h-28 w-auto" priority />
          <div className="flex items-center gap-4">
            <Link href="/events" className="text-sm font-bold text-white/60 hover:text-white transition-colors">
              Events Platform
            </Link>
            {hasRelationalAccess ? (
              <Link
                href="/dashboard"
                className="text-sm font-bold text-white bg-vc-purple px-5 py-2 rounded-btn hover:bg-vc-purple-light transition-colors"
              >
                Relational
              </Link>
            ) : user ? (
              <a
                href="#waitlist"
                className="text-sm font-bold text-white bg-vc-purple px-5 py-2 rounded-btn hover:bg-vc-purple-light transition-colors"
              >
                Relational
              </a>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm font-bold text-white/60 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/sign-in?product=relational"
                  className="text-sm font-bold text-white bg-vc-purple px-5 py-2 rounded-btn hover:bg-vc-purple-light transition-colors"
                >
                  Relational
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-white px-6 py-24 md:py-32 relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-vc-purple/20 rounded-full blur-3xl animate-float" />
          <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-vc-teal/10 rounded-full blur-3xl" style={{ animationDelay: '3s' }} />
        </div>

        <div className="max-w-3xl mx-auto relative">
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-[0.95] tracking-tight">
            Built for the way<br />
            campaigns<br />
            <span className="text-gradient">actually run.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-6 leading-relaxed">
            Threshold is <span className="text-gradient font-semibold">two AI-powered tools</span> built for Democratic campaigns. Our <span className="text-gradient font-semibold">events platform</span> is open to Democrats &mdash; create a page, collect RSVPs, and message your attendees in minutes. Our <span className="text-gradient font-semibold">relational organizing tool</span> is in limited access: it gives organizers and volunteers an AI coach &mdash; customized to your campaign &mdash; that helps them work through their networks, match contacts to the voter file, and know who to call, what to say, and when to follow up.
          </p>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-10 leading-relaxed">
            AI isn&rsquo;t a feature we bolted on &mdash; it&rsquo;s how Threshold works. From rolodexing volunteers to suggesting conversation tactics, the AI makes using the products easier, so you and your team can focus on organizing and talking to voters.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#waitlist"
              className="inline-flex items-center gap-2 bg-white text-vc-purple font-bold font-display text-lg px-10 py-4 rounded-btn transition-all shadow-lifted hover:shadow-glow-lg hover:-translate-y-0.5"
            >
              Relational Tool
              <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 glass text-white font-bold font-display text-lg px-10 py-4 rounded-btn transition-all hover:bg-white/10"
            >
              <Calendar className="w-5 h-5" />
              Events Platform
            </Link>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section
        ref={featuresRef}
        className={`px-6 py-20 max-w-5xl mx-auto text-center opacity-0 ${featuresInView ? 'animate-slide-up' : ''}`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-teal/10 border border-vc-teal/20 text-vc-teal text-sm mb-4 mx-auto">
          <Sparkles className="w-4 h-4" />
          <span>Relational Organizing Tool</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 text-center tracking-tight">
          The AI campaign coach that actually knows your race
        </h2>
        <p className="text-white/50 text-center max-w-2xl mx-auto mb-14">
          Threshold isn&rsquo;t generic campaign software &mdash; it&rsquo;s an AI assistant trained on your specific race, your issues, and your strategy. Messy real-world input goes in, clean structured data comes out. If your volunteers can text, they can use Threshold.
        </p>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: Settings,
              title: 'Adapts to Your Exact Strategy',
              desc: 'Your AI coach is securely trained on your campaign\u2019s specific priorities and organizing best practices. Whether your current goal is persuasion, GOTV, volunteer recruitment, fundraising, or rapid list-building, the AI seamlessly tailors its coaching and talking points to match your immediate objective. Built by scrappy organizers, Threshold can be custom-tailored and coded for your unique campaign.',
              color: 'bg-vc-gold/10 text-vc-gold',
            },
            {
              icon: BookUser,
              title: 'AI-Powered Rolodexing',
              desc: 'Most volunteers know dozens of potential voters but freeze up when asked to list them. Through natural conversation, the AI acts as a thought partner \u2014 jogging their memory about their neighborhood, workplace, church, and social circles \u2014 rapidly building a high-impact relational outreach list faster than they ever could alone, then handling the data entry for them. Plus it\u2019s only one click for volunteers to send prewritten texts and links to their friends and neighbors.',
              color: 'bg-vc-purple/10 text-vc-purple-light',
            },
            {
              icon: MessageCircle,
              title: 'AI-Powered Data Input',
              desc: 'Campaign software usually requires navigating dropdowns, survey questions, and rigid forms after every interaction. Threshold handles it automatically. After a text, call, or one-on-one, volunteers simply tell the AI how the conversation went. The AI extracts the data, logs the specific survey responses, and updates the contact\u2019s profile \u2014 accurately entering several conversations at once, saving time so everyone can focus on talking to more voters.',
              color: 'bg-vc-coral/10 text-vc-coral',
            },
            {
              icon: Sparkles,
              title: 'Zero-Friction for the Whole Team',
              desc: 'Organizing doesn\u2019t always go by the book. Sometimes a volunteer texts their organizer a messy recap, or the campaign needs to enter data on someone\u2019s behalf. Threshold\u2019s AI and OCR tools work across accounts \u2014 organizers and campaign staff can process conversations, scan sign-in sheets, and update contact records for any volunteer. Messy real-world input goes in, clean structured data comes out.',
              color: 'bg-vc-purple/10 text-vc-purple',
            },
            {
              icon: Globe,
              title: 'Geofiltered Voter Matching',
              desc: 'Rolodexing against a massive voter file shouldn\u2019t take hours. Threshold supercharges your voter matching with smart, location-based geofiltering. By immediately filtering contacts to your specific region or district, the AI matches partial names, fuzzy addresses, or just phone numbers to the voter file in milliseconds \u2014 making list-building lightning-fast and highly accurate.',
              color: 'bg-vc-teal/10 text-vc-teal',
            },
            {
              icon: Shield,
              title: 'Private & VoteBuilder-Ready',
              desc: 'Your campaign strategy, voter data, and conversation logs are strictly siloed and never shared or used to train public AI models. Every contact, RSVP, and canvass response is tracked and instantly exportable in VoteBuilder-ready formats, seamlessly feeding back into your existing data infrastructure.',
              color: 'bg-vc-teal/10 text-vc-teal',
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="glass-card p-7">
              <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Photo divider 2 */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <Image src="/hero-2.jpg" alt="" width={1200} height={900} className="w-full h-full object-cover" />
      </div>

      {/* Why relational organizing */}
      <section
        ref={whyRef}
        className={`text-white px-6 py-20 opacity-0 ${whyInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold mb-4 text-center tracking-tight">
            Why relational organizing wins
          </h2>
          <p className="text-white/50 text-center max-w-xl mx-auto mb-10">
            Voters are far more likely to engage when asked by someone they know. Threshold gives every volunteer the tools and AI coaching to make that ask count.
          </p>
          <div className="grid md:grid-cols-2 gap-5 text-left">
            {[
              'A personal ask from someone you trust is 10x more effective than a mailer or digital ad \u2014 and AI helps your volunteers make that ask confidently.',
              'Most people who skip elections aren\u2019t opposed to voting \u2014 they just need a nudge from someone they know. Your volunteers are that person.',
              'Your volunteers already have the relationships. Threshold\u2019s AI gives them voter file data, tailored talking points, and step-by-step coaching to make every contact count.',
              'Relational organizing scales with your people, not your ad spend. Every volunteer who joins multiplies your reach \u2014 and the AI makes each of them more effective.',
            ].map((text, i) => (
              <div key={i} className="flex gap-4 items-start glass-dark rounded-card p-5">
                <CheckCircle className="w-5 h-5 text-vc-teal flex-shrink-0 mt-0.5" />
                <p className="text-white/80 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo divider 3 */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <Image src="/hero-organizing.jpg" alt="" width={1200} height={900} className="w-full h-full object-cover" style={{ objectPosition: 'center 70%' }} />
      </div>

      {/* Events Platform — brief mention */}
      <section
        ref={eventsRef}
        className={`px-6 py-10 opacity-0 ${eventsInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/40 text-sm leading-relaxed mb-3">
            We also offer the <span className="text-white/60 font-semibold">Threshold Events Platform</span> &mdash; create event pages, collect RSVPs, and message attendees in minutes. Open to all Democrats, no waitlist required.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-vc-purple-light text-sm font-bold hover:text-white transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Explore Events
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Waitlist + Contact */}
      <section
        id="waitlist"
        ref={contactRef}
        className={`px-6 pt-10 pb-20 opacity-0 ${contactInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              Join the waitlist for our relational organizing tool
            </h2>
            <p className="text-white/50 max-w-xl mx-auto mb-4 leading-relaxed">
              This is a separate tool from our events platform and is currently in limited access. It helps your organizers and volunteers work through their networks, match contacts to the voter file, and prep for every conversation &mdash; with an AI model customized to your campaign&rsquo;s priorities. If they can text, they can use Threshold.
            </p>
            <p className="text-white/40 max-w-lg mx-auto leading-relaxed text-sm">
              We&rsquo;ll reach out to set up a workspace trained on your race, your district, and your issues. The Events Platform is open to all Democrats &mdash; no waitlist required. We built this for people like us.
            </p>
          </div>

          {formStatus === 'sent' ? (
            <div className="glass-card p-8 text-center">
              <CheckCircle className="w-12 h-12 text-vc-teal mx-auto mb-4" />
              <h3 className="font-display text-xl font-bold text-white mb-2">You&rsquo;re on the list!</h3>
              <p className="text-white/60">We&rsquo;ll be in touch soon to get your campaign set up.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">Name</label>
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
                  <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">Email</label>
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
                  placeholder="Campaign or organization name (optional)"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-1.5">Message (optional)</label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 rounded-btn text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50 resize-none"
                  placeholder="Tell us about your campaign — what office, what state, and how we can help..."
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
                  'Sending...'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Join the Waitlist
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-white/30 text-sm text-center mt-6">
            Or email us directly at{' '}
            <a href="mailto:info@thresholdvote.com" className="text-vc-purple-light hover:underline">
              info@thresholdvote.com
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-white/5 mt-auto">
        <Link href="/about" className="text-white/40 text-sm font-medium hover:text-white/60 transition-colors">
          About Threshold
        </Link>
        <p className="text-white/30 text-xs mt-3">
          &copy; {new Date().getFullYear()} Vote Threshold LLC. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-1">
          <Link href="/privacy" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Privacy Policy</Link>
          <span className="text-white/10 text-[10px]">|</span>
          <Link href="/terms" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Terms of Service</Link>
          <span className="text-white/10 text-[10px]">|</span>
          <a href="mailto:info@thresholdvote.com" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">info@thresholdvote.com</a>
        </div>
      </footer>
    </main>
  )
}
