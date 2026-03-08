'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, ArrowRight, Calendar } from 'lucide-react'
import { trackDemoBooking } from '@/lib/google-ads'

export default function DemoThankYouPage() {
  useEffect(() => {
    // Fire Google Ads conversion when this page loads
    trackDemoBooking()
  }, [])

  return (
    <main className="min-h-screen cosmic-bg constellation flex flex-col">
      {/* Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-20 md:h-28 w-auto" priority />
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            You&rsquo;re booked!
          </h1>

          <p className="text-white/50 text-lg leading-relaxed mb-8">
            We&rsquo;ll walk you through how Threshold&rsquo;s AI-powered relational organizing tool can help your campaign reach more voters through the people who know them best.
          </p>

          <div className="glass-card p-6 mb-8 text-left">
            <h2 className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              What to expect
            </h2>
            <ul className="space-y-3 text-white/60 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-vc-purple-light font-bold mt-0.5">1.</span>
                <span>A calendar invite with a video link is on its way to your inbox</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-vc-purple-light font-bold mt-0.5">2.</span>
                <span>We&rsquo;ll do a 15-minute live walkthrough of the platform</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-vc-purple-light font-bold mt-0.5">3.</span>
                <span>Bring questions about your race &mdash; we&rsquo;ll show you how Threshold adapts to your specific campaign</span>
              </li>
            </ul>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-vc-purple hover:bg-vc-purple/80 text-white font-medium transition-colors"
          >
            Back to Threshold
            <ArrowRight className="w-4 h-4" />
          </Link>

          <p className="text-white/30 text-sm mt-8">
            Questions? Email us at{' '}
            <a href="mailto:info@thresholdvote.com" className="text-vc-purple-light hover:underline">
              info@thresholdvote.com
            </a>
          </p>
        </div>
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
