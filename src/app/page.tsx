'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useRef, useEffect, useState, RefObject, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ArrowRight, CheckCircle, Mail, Phone, Users, BarChart3, Settings, Send, Calendar, Sparkles, Brain, Zap, Shield, Globe, MessageCircle, BookUser } from 'lucide-react'

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
  const aiRef = useRef<HTMLElement>(null)
  const featuresRef = useRef<HTMLElement>(null)
  const whyRef = useRef<HTMLElement>(null)
  const contactRef = useRef<HTMLElement>(null)

  const eventsInView = useInView(eventsRef)
  const aiInView = useInView(aiRef)
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
                <a
                  href="#waitlist"
                  className="text-sm font-bold text-white bg-vc-purple px-5 py-2 rounded-btn hover:bg-vc-purple-light transition-colors"
                >
                  Relational
                </a>
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
            Threshold is a relational organizing platform that helps your volunteers turn their personal networks into a voter contact program. Add the people they already know, match them against state voter files, and track every conversation &mdash; with an AI coach that helps your team know who to call, what to say, and when to follow up.
          </p>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-10 leading-relaxed">
            Our events platform is live now &mdash; host canvassing shifts, phone banks, rallies, and more with tools built specifically for progressive organizers.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#waitlist"
              className="inline-flex items-center gap-2 bg-white text-vc-purple font-bold font-display text-lg px-10 py-4 rounded-btn transition-all shadow-lifted hover:shadow-glow-lg hover:-translate-y-0.5"
            >
              Join the Waitlist
              <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 glass text-white font-bold font-display text-lg px-10 py-4 rounded-btn transition-all hover:bg-white/10"
            >
              <Calendar className="w-5 h-5" />
              Try the Events Platform
            </Link>
          </div>
        </div>
      </section>

      {/* Relational Organizing Features — the big draw */}
      <section
        ref={featuresRef}
        className={`px-6 py-20 max-w-5xl mx-auto text-center opacity-0 ${featuresInView ? 'animate-slide-up' : ''}`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-teal/10 border border-vc-teal/20 text-vc-teal text-sm mb-4 mx-auto">
          <Sparkles className="w-4 h-4" />
          <span>Relational Organizing Tool</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 text-center tracking-tight">
          Everything your team needs to run a voter contact program
        </h2>
        <p className="text-white/50 text-center max-w-2xl mx-auto mb-14">
          Volunteers add people they know, match them to the voter file, log every text, call, and one-on-one, and track who&rsquo;s a supporter &mdash; all in one place.
        </p>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: Users,
              title: 'Relational Contact Lists',
              desc: 'Volunteers add people they already know — family, friends, neighbors, coworkers — and build a personal outreach list. Contacts can be added manually, through the AI coach, or from their phone\u2019s contact list.',
              color: 'bg-vc-purple/10 text-vc-purple',
            },
            {
              icon: BarChart3,
              title: 'Voter File Integration',
              desc: 'Automatically match contacts against your state voter file to see registration status, party affiliation, voting history, and district info. AI-powered fuzzy matching finds the right voter even with incomplete names or addresses.',
              color: 'bg-vc-teal/10 text-vc-teal',
            },
            {
              icon: Phone,
              title: 'Outreach Tracking',
              desc: 'Log every text, call, and one-on-one meeting. Record outcomes — supporter, undecided, opposed, no answer — recruit volunteer prospects, and add custom survey responses. Campaign managers see it all in real time.',
              color: 'bg-vc-coral/10 text-vc-coral',
            },
            {
              icon: Settings,
              title: 'Campaign Customization',
              desc: 'Each campaign gets its own workspace with custom survey questions, branding, election dates, and talking points. Campaigns can train the AI coach on their specific issues, endorsements, and messaging.',
              color: 'bg-vc-gold/10 text-vc-gold',
            },
            {
              icon: Mail,
              title: 'Team Management',
              desc: 'Invite volunteers by email, assign admin or volunteer roles, and track who\u2019s making the most contacts. Leaderboards and conversion stats show your campaign\u2019s progress at a glance.',
              color: 'bg-vc-purple/10 text-vc-purple-light',
            },
            {
              icon: Globe,
              title: 'Data Export',
              desc: 'Export your contacts, canvass responses, and outreach data in VoteBuilder-ready CSV format anytime. Keep your data portable and ready for any tool.',
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

      {/* Photo divider 1 */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <Image src="/hero-3.jpg" alt="" width={1200} height={900} className="w-full h-full object-cover" />
      </div>

      {/* AI-Powered Section */}
      <section
        ref={aiRef}
        className={`px-6 py-20 opacity-0 ${aiInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-gold/10 border border-vc-gold/20 text-vc-gold text-sm mb-4">
              <Brain className="w-4 h-4" />
              <span>AI-Powered</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              An AI campaign coach that actually knows your race
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto leading-relaxed">
              Every volunteer gets an AI assistant trained on your campaign&rsquo;s issues, endorsements, and messaging. It helps them add contacts, prep for conversations, and log outcomes &mdash; all through a simple chat interface.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-gold/10 text-vc-gold flex items-center justify-center mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Always on the cutting edge</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Threshold runs on the latest AI models and upgrades automatically. Your campaign coach gets smarter over time.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-purple/10 text-vc-purple-light flex items-center justify-center mb-4">
                <BookUser className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Smart contact rolodex</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                The AI coach helps volunteers think through who they know &mdash; by neighborhood, workplace, church, gym, or social circle &mdash; and adds them to their outreach list with the right details already filled in.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-coral/10 text-vc-coral flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Better conversations, faster</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Before every call or knock, volunteers can ask the AI for talking points tailored to that voter&rsquo;s history and interests. After the conversation, it helps them log the outcome and suggests a follow-up plan.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-purple/10 text-vc-purple flex items-center justify-center mb-4">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Works the way you do</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                No tech background needed. Everything is in plain language anyone on your team can use &mdash; just tell it what you need and it handles the rest.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-teal/10 text-vc-teal flex items-center justify-center mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Your data stays yours</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Your voter data, campaign strategy, and conversation logs are never used to train AI models or shared with third parties. Your campaign context stays private to your team.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-teal/10 text-vc-teal flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">AI-powered voter matching</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                When a volunteer adds a contact, AI fuzzy-matches them against the state voter file &mdash; even with partial names or missing addresses. Matched contacts show registration status, vote history, and district info instantly.
              </p>
            </div>
          </div>
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
            Voters are more likely to engage when asked by someone they know and trust. Threshold makes that process scalable.
          </p>
          <div className="grid md:grid-cols-2 gap-5 text-left">
            {[
              'A personal ask from someone you trust is 10x more effective than a mailer or digital ad.',
              'Most people who skip elections aren\'t opposed to voting — they just need a nudge from someone they know.',
              'Your volunteers already have the relationships. Threshold gives them voter file data, conversation guides, and an AI coach to make every contact count.',
              'Relational organizing scales with your people, not your ad spend. Every volunteer who joins multiplies your reach.',
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
        <Image src="/hero-organizing.jpg" alt="" width={1200} height={900} className="w-full h-full object-cover" />
      </div>

      {/* Events Platform CTA */}
      <section
        ref={eventsRef}
        className={`px-6 pt-16 pb-8 opacity-0 ${eventsInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-3xl mx-auto">
          <div className="glass-card p-8 md:p-10 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-vc-purple/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-vc-teal/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-purple/10 border border-vc-purple/20 text-vc-purple-light text-sm mb-4">
                <Calendar className="w-4 h-4" />
                <span>Now Live</span>
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-white mb-3 tracking-tight">
                Threshold Events Platform
              </h2>
              <p className="text-white/60 leading-relaxed mb-3 max-w-xl">
                Host canvassing shifts, phone banks, rallies, fundraisers, voter registration drives, watch parties, and 14 other event types &mdash; each with its own shareable page, RSVP management, comment threads, emoji reactions, and countdown timers. Built for organizing, not generic event software.
              </p>
              <p className="text-white/40 leading-relaxed mb-6 max-w-xl text-sm">
                Create an account in minutes. Start free with 2 events, no credit card required. Paid plans add unlimited events, team members, custom branding, and analytics.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 bg-vc-purple text-white font-bold font-display text-base px-8 py-3 rounded-btn transition-all hover:bg-vc-purple-light hover:shadow-glow"
                >
                  <Calendar className="w-4 h-4" />
                  Explore Events
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/events/pricing"
                  className="inline-flex items-center gap-2 glass text-white font-bold font-display text-base px-8 py-3 rounded-btn transition-all hover:bg-white/10"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
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
              Get early access to our relational organizing tool
            </h2>
            <p className="text-white/50 max-w-xl mx-auto mb-4 leading-relaxed">
              Your volunteers add the people they know, we match them to the voter file, an AI coach helps prep every conversation, and you see every outcome in real time. One platform for your entire voter contact program.
            </p>
            <p className="text-white/40 max-w-lg mx-auto leading-relaxed text-sm">
              Join the waitlist and we&rsquo;ll reach out to set up a workspace tailored to your race, your district, and your issues.
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
        <p className="text-white/30 text-xs">
          &copy; {new Date().getFullYear()} Vote Threshold LLC. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-1">
          <Link href="/privacy" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Privacy Policy</Link>
          <span className="text-white/10 text-[10px]">|</span>
          <a href="mailto:info@thresholdvote.com" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">info@thresholdvote.com</a>
        </div>
      </footer>
    </main>
  )
}
