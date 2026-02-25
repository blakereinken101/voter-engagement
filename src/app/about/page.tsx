'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export default function AboutPage() {
  return (
    <main className="min-h-screen cosmic-bg constellation">
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

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
          {/* Headshot */}
          <div className="shrink-0 mx-auto md:mx-0">
            <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <Image
                src="/blake-headshot.jpg"
                alt="Blake Reinken"
                width={400}
                height={400}
                className="w-full h-full object-cover object-top"
                priority
              />
            </div>
          </div>

          {/* Bio */}
          <div className="flex-1">
            <p className="text-vc-purple font-semibold text-sm tracking-wide uppercase mb-2">Founder &amp; CEO</p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight">
              Blake Reinken
            </h1>

            <div className="space-y-5 text-white/70 leading-relaxed text-[15px]">
              <p>
                Blake Reinken has held senior organizing and field leadership roles on presidential and congressional races.
              </p>
              <p>
                Blake managed a congressional campaign to victory in a hyper-competitive 15-way contest, and has experience overseeing large-scale volunteer and paid field programs. Across his campaign work, he saw firsthand how often organizers, volunteers, and paid workers are asked to win with tools that are outdated, expensive, or poorly designed.
              </p>
              <p>
                He founded Threshold to change that &mdash; two products that combine intuitive product design with the intelligent deployment of AI-powered tools that help campaigns activate personal networks at scale.
              </p>
              <p>
                Blake is currently a 3L at New York University School of Law, where he studies governance. Threshold is an independent venture and is not affiliated with or endorsed by any political campaign or academic institution.
              </p>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <Link
            href="/"
            className="text-white/40 text-sm hover:text-white/60 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Threshold
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-white/5 mt-auto">
        <p className="text-white/30 text-xs">
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
