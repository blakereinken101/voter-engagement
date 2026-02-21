'use client'
import Link from 'next/link'
import { useRef, useEffect, useState, RefObject } from 'react'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import brandConfig from '@/lib/brand-config'
import campaignConfig from '@/lib/campaign-config'

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
    <main className="min-h-screen flex flex-col">
      {/* Resume banner */}
      {hasExistingData && (
        <div className="bg-rally-yellow text-rally-navy px-6 py-4 text-center">
          <p className="font-bold">
            Welcome back! You have {state.personEntries.length} people in your circle.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            <Link href="/dashboard" className="font-bold underline">Continue your plan</Link>
            <Link href="/rolodex" className="font-bold underline">Open rolodex</Link>
            <button
              onClick={() => { dispatch({ type: 'RESET' }); }}
              className="text-sm opacity-60 hover:opacity-100"
            >
              Start over
            </button>
          </div>
          {state.userId && (
            <p className="text-rally-navy/30 text-[10px] font-mono mt-2">ID: {state.userId}</p>
          )}
        </div>
      )}

      {/* Hero */}
      <section className="bg-rally-navy text-white px-6 py-24 relative overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-64 h-64 bg-rally-red rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-rally-yellow rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rally-green rounded-full blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto relative">
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 leading-[0.95]">
            Your network is<br />
            <span className="text-rally-red">your most powerful</span><br />
            <span className="text-rally-yellow">vote.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/60 max-w-xl mb-10 leading-relaxed">
            The people who trust you are the ones who will listen. Build your list. Find who votes and who does not. Start the right conversations.
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-rally-red hover:bg-rally-red-light text-white font-bold font-display text-lg px-10 py-4 rounded-lg transition-all shadow-lg shadow-rally-red/30 hover:shadow-rally-red/50"
          >
            {user ? 'Continue Your Plan' : 'Build Your Circle'}
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section
        ref={howRef}
        className={`px-6 py-20 max-w-4xl mx-auto opacity-0 ${howInView ? 'animate-slide-up' : ''}`}
      >
        <h2 className="font-display text-3xl font-bold text-rally-navy mb-12 text-center">
          Three steps. Real impact.
        </h2>
        <div className="grid md:grid-cols-3 gap-0">
          {[
            {
              num: '01',
              title: 'Build your list',
              desc: 'Walk through your relationships — family, friends, coworkers, neighbors. We help you think of about 50 people you know.',
              color: 'text-rally-red',
            },
            {
              num: '02',
              title: 'We find them',
              desc: 'We match your list against your state\'s public voter file to see who votes consistently and who does not.',
              color: 'text-rally-yellow',
            },
            {
              num: '03',
              title: 'Have the conversation',
              desc: 'Get a personalized script for each person — recruit your champions, motivate your sometimes voters, and gently engage the rest.',
              color: 'text-rally-green',
            },
          ].map(({ num, title, desc, color }, idx) => (
            <div key={num} className="flex items-start">
              <div className="p-6 flex-1">
                <div className={`font-mono text-4xl font-bold ${color} mb-3`}>{num}</div>
                <h3 className="font-display font-bold text-xl text-rally-navy mb-2">{title}</h3>
                <p className="text-rally-slate-light leading-relaxed">{desc}</p>
              </div>
              {idx < 2 && (
                <div className="hidden md:flex items-center pt-10 text-rally-navy/20 text-3xl font-light select-none" aria-hidden="true">
                  <span className="border-l-2 border-dashed border-rally-navy/15 h-16 mr-1" />
                  <span>&#8250;</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Why it works */}
      <section
        ref={whyRef}
        className={`bg-rally-navy text-white px-6 py-16 opacity-0 ${whyInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-6">
            Why this works
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            {[
              'A personal ask from someone you trust is 10x more effective than any ad or mailer.',
              'Most people who skip midterms are not opposed to voting — they just need a nudge.',
              'You already know who these people are. You just need the data and the script.',
              'One person having 50 conversations can move more votes than a $50,000 ad buy.',
            ].map((text, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-rally-red font-bold text-lg mt-0.5">→</span>
                <p className="text-white/70 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy / Footer */}
      <section
        ref={privacyRef}
        className={`px-6 py-12 text-center border-t border-gray-200 bg-gradient-to-b from-transparent to-rally-navy/[0.03] opacity-0 ${privacyInView ? 'animate-slide-up' : ''}`}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-rally-navy/10" />
            <span className="text-rally-navy/30 text-xs font-medium uppercase tracking-widest">Privacy</span>
            <span className="h-px w-8 bg-rally-navy/10" />
          </div>
          <p className="text-rally-slate-light text-sm leading-relaxed">
            {campaignConfig.privacyText || brandConfig.privacyText}
          </p>
          <p className="text-rally-navy/20 text-[10px] font-mono mt-4">
            {campaignConfig.name} | {campaignConfig.state}
          </p>
        </div>
      </section>
    </main>
  )
}
