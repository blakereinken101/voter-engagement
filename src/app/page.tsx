'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useRef, useEffect, useState, RefObject } from 'react'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import campaignConfig from '@/lib/campaign-config'
import { Users, Search, MessageCircle, ArrowRight, Shield } from 'lucide-react'

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
  const { state, dispatch } = useAppContext()
  const { user } = useAuth()
  const hasExistingData = state.personEntries.length > 0 || state.actionPlanState.length > 0

  const howRef = useRef<HTMLElement>(null)
  const whyRef = useRef<HTMLElement>(null)
  const privacyRef = useRef<HTMLElement>(null)

  const howInView = useInView(howRef)
  const whyInView = useInView(whyRef)
  const privacyInView = useInView(privacyRef)

  return (
    <main className="min-h-screen flex flex-col cosmic-bg constellation">
      {/* Resume banner */}
      {hasExistingData && (
        <div className="bg-gradient-to-r from-vc-purple to-vc-purple-light text-white px-6 py-4 text-center">
          <p className="font-bold">
            Welcome back! You have {state.personEntries.length} people in your circle.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            <Link href="/dashboard" className="font-bold underline hover:opacity-80 transition-opacity">Continue your plan</Link>
            <Link href="/rolodex" className="font-bold underline hover:opacity-80 transition-opacity">Open rolodex</Link>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="text-white px-6 py-28 relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-vc-purple/20 rounded-full blur-3xl animate-float" />
          <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-vc-teal/10 rounded-full blur-3xl" style={{ animationDelay: '3s' }} />
        </div>

        <div className="max-w-3xl mx-auto relative">
          <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-48 md:h-72 w-auto mb-8" priority />
          <h1 className="font-display text-5xl md:text-7xl font-extrabold mb-6 leading-[0.95] tracking-tight">
            Your network is<br />
            your most powerful<br />
            <span className="text-gradient">vote.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/60 max-w-xl mb-10 leading-relaxed">
            The people who trust you are the ones who will listen. Build your list. Find who votes and who doesn&apos;t. Start the right conversations.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-white text-vc-purple font-bold font-display text-lg px-10 py-4 rounded-btn transition-all shadow-lifted hover:shadow-glow-lg hover:-translate-y-0.5"
          >
            {user ? 'Continue Your Plan' : 'Build Your Circle'}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section
        ref={howRef}
        className={`px-6 py-24 max-w-4xl mx-auto opacity-0 ${howInView ? 'animate-slide-up' : ''}`}
      >
        <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-16 text-center tracking-tight">
          Three steps. Real impact.
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Users,
              title: 'Build your list',
              desc: 'Walk through your relationships — family, friends, coworkers, neighbors. We help you think of about 50 people you know.',
              color: 'bg-vc-purple/10 text-vc-purple',
            },
            {
              icon: Search,
              title: 'We find them',
              desc: 'We match your list against your state\'s public voter file to see who votes consistently and who doesn\'t.',
              color: 'bg-vc-teal/10 text-vc-teal',
            },
            {
              icon: MessageCircle,
              title: 'Have the conversation',
              desc: 'Get a personalized approach for each person — recruit your champions, motivate your sometimes voters, and gently engage the rest.',
              color: 'bg-vc-coral/10 text-vc-coral',
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="glass-card p-8 text-center">
              <div className={`w-14 h-14 rounded-xl ${color} flex items-center justify-center mx-auto mb-5`}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-3">{title}</h3>
              <p className="text-white/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why it works */}
      <section
        ref={whyRef}
        className={`text-white px-6 py-20 opacity-0 ${whyInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold mb-10 text-center tracking-tight">
            Why this works
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            {[
              'A personal ask from someone you trust is 10x more effective than any ad or mailer.',
              'Most people who skip elections aren\'t opposed to voting — they just need a nudge.',
              'You already know who these people are. You just need the data and the approach.',
              'One person having 50 conversations can move more votes than a $50,000 ad buy.',
            ].map((text, i) => (
              <div key={i} className="flex gap-4 items-start glass-dark rounded-card p-5">
                <ArrowRight className="w-5 h-5 text-vc-teal flex-shrink-0 mt-0.5" />
                <p className="text-white/80 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy / Footer */}
      <section
        ref={privacyRef}
        className={`px-6 py-16 text-center opacity-0 ${privacyInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-4 h-4 text-white/40" />
            <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">Privacy</span>
          </div>
          <p className="text-white/50 text-sm leading-relaxed">
            {campaignConfig.privacyText}
          </p>
          <p className="text-white/20 text-xs mt-6">
            {campaignConfig.name} | {campaignConfig.state}
          </p>
        </div>
      </section>
    </main>
  )
}
