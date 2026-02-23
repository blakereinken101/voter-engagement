'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useRef, useEffect, useState, RefObject, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ArrowRight, CheckCircle, Mail, Phone, Users, BarChart3, Settings, Send, Calendar, Sparkles } from 'lucide-react'

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
  const { user } = useAuth()
  const featuresRef = useRef<HTMLElement>(null)
  const whyRef = useRef<HTMLElement>(null)
  const contactRef = useRef<HTMLElement>(null)

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
            {user ? (
              <Link
                href="/dashboard"
                className="text-sm font-bold text-white bg-vc-purple px-5 py-2 rounded-btn hover:bg-vc-purple-light transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm font-bold text-white/60 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/sign-in"
                  className="text-sm font-bold text-white bg-vc-purple px-5 py-2 rounded-btn hover:bg-vc-purple-light transition-colors"
                >
                  Get Started
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
            Relational organizing<br />
            the way it<br />
            <span className="text-gradient">actually works.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-6 leading-relaxed">
            The most effective voter contact programs aren&rsquo;t built by an app. They&rsquo;re built through real conversations and organizing.
          </p>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-10 leading-relaxed">
            Your campaign isn&rsquo;t anyone else&rsquo;s. Your program shouldn&rsquo;t be either. Threshold builds tools for progressive campaigns &mdash; from our live events platform to our upcoming relational organizing software that helps your program scale and win.
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
              <Calendar className="w-4 h-4" />
              Events Platform
            </Link>
          </div>
        </div>
      </section>

      {/* Photo divider 1 */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <Image src="/hero-3.jpg" alt="" width={1200} height={900} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-transparent to-[#0a0a1a]" />
      </div>

      {/* Events Platform CTA */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="glass-card p-8 md:p-10 relative overflow-hidden">
            {/* Background accent */}
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
                A free, purpose-built events platform for progressive campaigns and organizations. Host canvassing shifts, phone banks, rallies, voter registration drives, house parties, and more &mdash; all with tools designed for organizers, not generic event software.
              </p>
              <p className="text-white/40 leading-relaxed mb-6 max-w-xl text-sm">
                Manage RSVPs, coordinate volunteers, and keep your movement connected. No account required to get started.
              </p>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 bg-vc-purple text-white font-bold font-display text-base px-8 py-3 rounded-btn transition-all hover:bg-vc-purple-light hover:shadow-glow"
              >
                <Calendar className="w-4 h-4" />
                Check Out the Events Platform
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        ref={featuresRef}
        className={`px-6 py-20 max-w-5xl mx-auto opacity-0 ${featuresInView ? 'animate-slide-up' : ''}`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-teal/10 border border-vc-teal/20 text-vc-teal text-sm mb-4 mx-auto">
          <Sparkles className="w-4 h-4" />
          <span>Relational Organizing Tool &mdash; Coming Soon</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 text-center tracking-tight">
          Built for the way campaigns actually run
        </h2>
        <p className="text-white/50 text-center max-w-2xl mx-auto mb-14">
          Every campaign is different. Our relational organizing platform gives your team the tools to build a voter contact program that fits your strategy, your voters, and your people.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Users,
              title: 'Relational Contact Lists',
              desc: 'Volunteers build personal outreach lists from their own networks — family, friends, neighbors, coworkers. Real relationships, real conversations.',
              color: 'bg-vc-purple/10 text-vc-purple',
            },
            {
              icon: BarChart3,
              title: 'Voter File Matching',
              desc: 'Automatically match contacts against your state voter file to see registration status, voting history, and identify persuasion targets.',
              color: 'bg-vc-teal/10 text-vc-teal',
            },
            {
              icon: Phone,
              title: 'Outreach Tracking',
              desc: 'Track every conversation — texts, calls, and one-on-ones. Record outcomes, recruit volunteers, and see your program grow in real time.',
              color: 'bg-vc-coral/10 text-vc-coral',
            },
            {
              icon: Settings,
              title: 'Campaign Customization',
              desc: 'Custom survey questions, branding, election dates, and multi-state support. Your platform adapts to your campaign, not the other way around.',
              color: 'bg-vc-gold/10 text-vc-gold',
            },
            {
              icon: Mail,
              title: 'Team Management',
              desc: 'Invite volunteers by email, manage roles and permissions, and track performance with leaderboards and conversion stats.',
              color: 'bg-vc-purple/10 text-vc-purple-light',
            },
            {
              icon: CheckCircle,
              title: 'Data Export',
              desc: 'Export your data in standard formats for integration with VoteBuilder, VAN, and other campaign tools you already use.',
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-transparent to-[#0a0a1a]" />
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
              'A personal ask from someone you trust is more effective than any ad or mailer.',
              'Most people who skip elections aren\'t opposed to voting — they just need a nudge from someone they know.',
              'Your volunteers already have the relationships. Threshold gives them the data and the tools.',
              'Relational organizing scales with your people, not your budget.',
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-transparent to-[#0a0a1a]" />
      </div>

      {/* Waitlist + Contact */}
      <section
        id="waitlist"
        ref={contactRef}
        className={`px-6 py-20 opacity-0 ${contactInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-teal/10 border border-vc-teal/20 text-vc-teal text-sm mb-4">
              <Sparkles className="w-4 h-4" />
              <span>Coming Soon</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              Join the waitlist
            </h2>
            <p className="text-white/50 max-w-xl mx-auto mb-4 leading-relaxed">
              Threshold&rsquo;s relational organizing platform helps your volunteers turn their personal networks into your most powerful voter contact program &mdash; with guided contact building, automatic voter file matching, and real-time outreach tracking all in one place.
            </p>
            <p className="text-white/40 max-w-lg mx-auto leading-relaxed text-sm">
              We&rsquo;re onboarding campaigns now for early access. Sign up below and our team will reach out to build a program tailored to your race.
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
                <p className="text-vc-coral text-sm">Something went wrong. Please try again or email us directly at <a href="mailto:info@votethreshold.com" className="underline">info@votethreshold.com</a>.</p>
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
            <a href="mailto:info@votethreshold.com" className="text-vc-purple-light hover:underline">
              info@votethreshold.com
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
          <a href="mailto:info@votethreshold.com" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">info@votethreshold.com</a>
        </div>
      </footer>
    </main>
  )
}
