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
          Give every organizer an AI-powered campaign coach
        </h2>
        <p className="text-white/50 text-center max-w-2xl mx-auto mb-14">
          Threshold helps organizers and volunteers do what they already do &mdash; just faster and better. Through a simple chat conversation, the AI helps them work through their full networks and build a contact list they&rsquo;d never put together on their own. No forms, no menus &mdash; if they can text, they can use Threshold. The model is fully customizable to your campaign&rsquo;s priorities, issues, and messaging.
        </p>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: Users,
              title: 'Relational Contact Lists',
              desc: 'Volunteers add the people they already know \u2014 family, friends, neighbors, coworkers. The AI coach helps them think through their full network and builds their outreach list automatically, or they can add contacts manually.',
              color: 'bg-vc-purple/10 text-vc-purple',
            },
            {
              icon: BarChart3,
              title: 'Voter File Integration',
              desc: 'AI automatically matches every contact against your state voter file \u2014 even with partial names or addresses. Volunteers instantly see registration status, party affiliation, voting history, and district info without wasting time filling out forms.',
              color: 'bg-vc-teal/10 text-vc-teal',
            },
            {
              icon: Phone,
              title: 'Outreach Tracking',
              desc: 'Log every text, call, and one-on-one. After each conversation, the AI helps volunteers record the outcome, write a follow-up note, and decide who to contact next. Campaign managers see every result in real time.',
              color: 'bg-vc-coral/10 text-vc-coral',
            },
            {
              icon: Settings,
              title: 'Campaign Customization',
              desc: 'Each campaign trains the AI coach on its own issues, endorsements, and messaging. Every volunteer\u2019s conversations are guided by your talking points \u2014 consistently and at scale.',
              color: 'bg-vc-gold/10 text-vc-gold',
            },
            {
              icon: Mail,
              title: 'Team Management',
              desc: 'Invite volunteers by email and track who\u2019s making the most contacts. Leaderboards, conversion rates, and AI-generated summaries show your campaign\u2019s progress \u2014 so you know where to focus your energy.',
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
              Threshold&rsquo;s AI isn&rsquo;t a chatbot you have to prompt carefully &mdash; it&rsquo;s a purpose-built campaign coach. Every volunteer on your team gets an assistant trained on your specific race: your district, your issues, your endorsements, your messaging. It knows the voter file. It knows the script. It helps with every step.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-gold/10 text-vc-gold flex items-center justify-center mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Always on the cutting edge</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Threshold runs on the most capable AI models available and upgrades automatically. You get state-of-the-art AI without managing it yourself.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-purple/10 text-vc-purple-light flex items-center justify-center mb-4">
                <BookUser className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">AI-powered contact building</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                The AI coach walks volunteers through their full network &mdash; neighborhood, workplace, church, gym, social circles &mdash; and populates their outreach list faster than any spreadsheet. Most volunteers find contacts they forgot they had.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-coral/10 text-vc-coral flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Conversation coaching in real time</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Before every call or knock, volunteers get AI talking points tailored to that specific voter. After the conversation, the AI helps them log the outcome and tells them exactly what to do next.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-purple/10 text-vc-purple flex items-center justify-center mb-4">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">No tech background needed</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Volunteers interact through plain conversation &mdash; no forms to fill out, no menus to navigate. If they can text, they can use Threshold. The AI figures out the rest.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-teal/10 text-vc-teal flex items-center justify-center mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Your data stays yours</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Your voter data, campaign strategy, and conversation logs are never used to train AI models or shared with anyone outside your team. The AI is powerful because it knows your race &mdash; that knowledge stays private.
              </p>
            </div>
            <div className="glass-card p-7">
              <div className="w-12 h-12 rounded-xl bg-vc-teal/10 text-vc-teal flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">AI voter file matching</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                The moment a contact is added, AI matches them to the state voter file &mdash; even with a nickname or a partial address. Volunteers see registration status, voting history, and district info before they ever pick up the phone.
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
              <p className="text-white/60 leading-relaxed mb-6 max-w-xl">
                Any Democrat can sign up and have their first event page live in minutes &mdash; no onboarding calls, no week-long setup. Host canvasses, phone banks, rallies, fundraisers, watch parties, and more. AI helps you write event descriptions, message your attendees, and manage follow-ups. It&rsquo;s clean, modern, easy to use, and more affordable than the major competitors. Each event gets a shareable page, RSVP management, attendee messaging, and comment threads.
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
