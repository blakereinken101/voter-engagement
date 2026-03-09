'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Video } from 'lucide-react'
import Cal from '@calcom/embed-react'
import { persistGclid } from '@/lib/google-ads'

const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || 'thresholdvote/demo'

export default function DemoPage() {
  useEffect(() => {
    // Store gclid from Google Ads click
    persistGclid()

    // Listen for Cal.com booking completion — redirect to thank-you page
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

        {/* Cal.com Booking */}
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
