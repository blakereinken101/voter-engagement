'use client'

import { useEffect, useRef, useState, RefObject } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, ArrowLeft, Video, CheckCircle, Settings, Globe,
  MessageCircle, BookUser, Sparkles, Shield, Users, Brain,
  Calendar, Target, Zap,
} from 'lucide-react'
import Cal from '@calcom/embed-react'
import { persistGclid } from '@/lib/google-ads'

const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || 'thresholdvote/demo'

function useInView(ref: RefObject<HTMLElement | null>) {
  const [isInView, setIsInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsInView(true); observer.unobserve(el) } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return isInView
}

export default function DemoPage() {
  const howRef = useRef<HTMLElement>(null)
  const featuresRef = useRef<HTMLElement>(null)
  const compareRef = useRef<HTMLElement>(null)
  const whyRef = useRef<HTMLElement>(null)

  const howInView = useInView(howRef)
  const featuresInView = useInView(featuresRef)
  const compareInView = useInView(compareRef)
  const whyInView = useInView(whyRef)

  useEffect(() => {
    persistGclid()
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'CAL:booking_successful') {
        window.location.href = '/demo/thank-you'
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <main className="min-h-screen cosmic-bg constellation flex flex-col">
      {/* Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-20 md:h-28 w-auto" priority />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/events" className="text-sm font-bold text-white/60 hover:text-white transition-colors hidden sm:block">
              Events Platform
            </Link>
            <Link
              href="/"
              className="text-white/60 text-sm hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="text-white px-6 py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-vc-purple/20 rounded-full blur-3xl animate-float" />
          <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-vc-teal/10 rounded-full blur-3xl" style={{ animationDelay: '3s' }} />
        </div>

        <div className="max-w-3xl mx-auto relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-teal/10 border border-vc-teal/20 text-vc-teal text-sm mb-6">
            <Brain className="w-4 h-4" />
            <span>AI-Powered Relational Organizing</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-[0.95] tracking-tight">
            Turn your volunteers&rsquo;<br />
            networks into{' '}
            <span className="text-gradient">votes.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Threshold is the AI campaign coach that helps volunteers work their personal networks &mdash; mapping contacts to the voter file, providing tailored talking points, and logging every conversation automatically.
          </p>
          <button
            onClick={() => document.getElementById('book-demo')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 bg-white text-vc-purple font-bold font-display text-lg px-10 py-4 rounded-btn transition-all shadow-lifted hover:shadow-glow-lg hover:-translate-y-0.5"
          >
            Book a Demo
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* App Screenshots */}
      <section className="px-6 py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] font-bold mb-10">
            From paper to voter file in seconds
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
            <div className="w-48 sm:w-40 md:w-48 p-1.5 rounded-[2.2rem] bg-gradient-to-b from-white/20 via-vc-purple/30 to-white/10 shadow-[0_0_60px_rgba(139,92,246,0.3)]">
              <div className="rounded-[1.8rem] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/app-scan-start.png"
                  alt="Scan a handwritten contact sheet with AI"
                  className="w-full h-auto block"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="w-6 h-6 text-vc-purple-light rotate-90 sm:rotate-0" />
              <span className="text-white/30 text-[10px] uppercase tracking-wider">AI extracts</span>
            </div>
            <div className="w-48 sm:w-40 md:w-48 p-1.5 rounded-[2.2rem] bg-gradient-to-b from-white/20 via-vc-purple/30 to-white/10 shadow-[0_0_60px_rgba(139,92,246,0.3)]">
              <div className="rounded-[1.8rem] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/app-scan-results.png"
                  alt="Extracted contacts ready to import and match to voter file"
                  className="w-full h-auto block"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-y border-white/5 py-6">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-white/40">
          {[
            { icon: Brain, label: 'AI-powered coaching' },
            { icon: Shield, label: 'Private & secure' },
            { icon: Users, label: 'Built by campaign organizers' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-vc-purple-light" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        ref={howRef}
        className={`px-6 py-20 md:py-28 opacity-0 ${howInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            How it works
          </h2>
          <p className="text-white/50 max-w-xl mx-auto mb-14">
            Three steps from sign-up to votes. No training manuals, no data entry headaches.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: BookUser,
                title: 'Import your network',
                desc: 'Through natural conversation, the AI jogs your volunteers\u2019 memory about their neighborhood, workplace, and social circles \u2014 rapidly building a relational contact list.',
                color: 'bg-vc-purple/10 text-vc-purple-light',
              },
              {
                step: '2',
                icon: Target,
                title: 'Match to voter file',
                desc: 'Smart geofiltered matching handles nicknames, misspellings, and partial info \u2014 connecting contacts to voter records in milliseconds.',
                color: 'bg-vc-teal/10 text-vc-teal',
              },
              {
                step: '3',
                icon: MessageCircle,
                title: 'Have real conversations',
                desc: 'AI coaching tailored to your candidate\u2019s issues and each voter\u2019s profile. After each conversation, tell the AI what happened \u2014 it logs everything.',
                color: 'bg-vc-gold/10 text-vc-gold',
              },
            ].map(({ step, icon: Icon, title, desc, color }) => (
              <div key={step} className="glass-card p-7 text-left relative">
                <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-vc-purple flex items-center justify-center text-white text-xs font-bold">
                  {step}
                </div>
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-2">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo moment */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <Image src="/hero-organizing.jpg" alt="Volunteers organizing in a neighborhood" fill className="object-cover object-center opacity-85" sizes="100vw" />
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#0A0E1A] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0A0E1A] to-transparent" />
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0A0E1A] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0A0E1A] to-transparent" />
      </div>

      {/* Key Features */}
      <section
        ref={featuresRef}
        className={`px-6 py-20 md:py-28 opacity-0 ${featuresInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 text-center tracking-tight">
            Everything your campaign needs
          </h2>
          <p className="text-white/50 text-center max-w-xl mx-auto mb-14">
            One platform for relational organizing, events, and voter engagement.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Settings,
                title: 'Adapts to Your Campaign',
                desc: 'Your AI coach is trained on your candidate\u2019s specific priorities. Whether your goal is persuasion, GOTV, or volunteer recruitment, the coaching adapts in real-time.',
                color: 'bg-vc-gold/10 text-vc-gold',
              },
              {
                icon: Globe,
                title: 'Smart Voter Matching',
                desc: 'Geofiltered matching finds voter records from partial names, nicknames, and fuzzy addresses in milliseconds. No more manual lookups.',
                color: 'bg-vc-teal/10 text-vc-teal',
              },
              {
                icon: Calendar,
                title: 'Events Platform',
                desc: 'Beautiful shareable event pages with RSVPs, comment threads, email reminders, and team coordination \u2014 included with relational package.',
                color: 'bg-vc-purple/10 text-vc-purple-light',
                badge: 'Included',
              },
              {
                icon: Sparkles,
                title: 'Zero-Friction Data Entry',
                desc: 'After a text, call, or one-on-one, volunteers simply tell the AI how it went. The AI extracts data, logs survey responses, and updates profiles automatically.',
                color: 'bg-vc-coral/10 text-vc-coral',
              },
            ].map(({ icon: Icon, title, desc, color, badge }) => (
              <div key={title} className="glass-card p-7 relative">
                {badge && (
                  <div className="absolute top-4 right-4 px-2 py-0.5 bg-vc-teal/15 border border-vc-teal/25 rounded-full text-vc-teal text-[10px] font-bold uppercase tracking-wider">
                    {badge}
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-2">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section
        ref={compareRef}
        className={`px-6 py-20 md:py-28 opacity-0 ${compareInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 text-center tracking-tight">
            A campaign platform like no other
          </h2>
          <p className="text-white/50 text-center max-w-xl mx-auto mb-10">
            Here&rsquo;s how Threshold <span className="text-gradient font-semibold">thinks</span> differently.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 pr-4 text-white/40 font-bold uppercase tracking-wider text-xs w-1/4"></th>
                  <th className="py-3 px-4 text-vc-purple-light font-bold uppercase tracking-wider text-xs">Threshold</th>
                  <th className="py-3 pl-4 text-vc-coral font-bold uppercase tracking-wider text-xs">Traditional Tools</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                {[
                  { label: 'Build your list', us: 'AI-guided conversation that maps your full network', them: 'Import contacts or add names manually' },
                  { label: 'Voter matching', us: 'Handles nicknames, misspellings, and partial info', them: 'Basic voter file lookup' },
                  { label: 'Conversation prep', us: 'Coaching tailored to each relationship and voter', them: 'Generic scripts' },
                  { label: 'After the conversation', us: 'Tell the AI what happened \u2014 it logs everything', them: 'Fill out forms manually' },
                  { label: 'Customization', us: 'AI trained on your candidate\u2019s issues', them: 'One-size-fits-all' },
                ].map(({ label, us, them }, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-4 pr-4 font-semibold text-white/90">{label}</td>
                    <td className="py-4 px-4 text-vc-teal">{us}</td>
                    <td className="py-4 pl-4 text-white/40">{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Why Relational Organizing */}
      <section
        ref={whyRef}
        className={`px-6 py-20 md:py-28 opacity-0 ${whyInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 text-center tracking-tight">
            Why relational organizing wins
          </h2>
          <p className="text-white/50 text-center max-w-xl mx-auto mb-10">
            Voters are far more likely to engage when asked by someone they know.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              'A personal ask from someone you trust is 10x more effective than a mailer or digital ad.',
              'Most non-voters aren\u2019t opposed to voting \u2014 they just need a nudge from someone they know.',
              'Your volunteers already have the relationships. Threshold gives them data and AI coaching to make every contact count.',
              'Relational organizing scales with your people, not your ad spend.',
            ].map((text, i) => (
              <div key={i} className="flex gap-4 items-start glass-dark rounded-card p-6">
                <CheckCircle className="w-5 h-5 text-vc-teal flex-shrink-0 mt-0.5" />
                <p className="text-white/80 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Book a Demo CTA + Cal.com */}
      <section id="book-demo" className="px-6 py-20 md:py-28">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-purple/10 border border-vc-purple/20 text-vc-purple-light text-sm mb-4">
              <Video className="w-4 h-4" />
              <span>Live Walkthrough</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              See it in action
            </h2>
            <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
              Book a quick demo and we&rsquo;ll walk through how Threshold can help your campaign. No pressure, no sales pitch &mdash; just a personalized walkthrough and Q&amp;A.
            </p>
          </div>

          <div className="glass-card p-2 overflow-hidden" style={{ minHeight: 500 }}>
            <Cal
              calLink={CAL_LINK}
              config={{ theme: 'dark' as const }}
              style={{ width: '100%', height: '100%', minHeight: 500, overflow: 'auto' }}
            />
          </div>

          <p className="text-white/30 text-sm text-center mt-6">
            Questions? Email us at{' '}
            <a href="mailto:info@thresholdvote.com" className="text-vc-purple-light hover:underline">
              info@thresholdvote.com
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-white/5 mt-auto">
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
