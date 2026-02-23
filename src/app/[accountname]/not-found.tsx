import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function AccountNotFound() {
  return (
    <div className="min-h-screen bg-vc-bg flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
          <SearchX className="w-8 h-8 text-white/30" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Account not found</h1>
        <p className="text-white/50 mb-8">
          This page doesn&apos;t exist. The account may have been removed or the URL might be incorrect.
        </p>
        <Link
          href="/events"
          className="inline-flex items-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all"
        >
          Browse Events
        </Link>
      </div>
    </div>
  )
}
