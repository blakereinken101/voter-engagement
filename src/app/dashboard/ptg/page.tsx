'use client'

import { useAuth } from '@/context/AuthContext'
import PtgDashboard from '@/components/ptg/PtgDashboard'
import Link from 'next/link'
import { ArrowLeft, LogOut } from 'lucide-react'

export default function PtgPage() {
  const { user, signOut, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center">
        <div className="text-white/40 animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
          <p className="text-white/50 mb-4">The conversations sheet is only available to campaign administrators and organizers.</p>
          <Link href="/dashboard" className="text-vc-purple-light hover:underline text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen cosmic-bg">
      <div className="constellation" />

      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard"
            className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-sm">{user.name}</span>
            <button onClick={signOut} className="text-white/30 hover:text-white/60 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content — wider for spreadsheet */}
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <PtgDashboard />
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .cosmic-bg { background: white !important; }
          .constellation { display: none !important; }
          * { color: black !important; }
          .bg-white\\/\\[0\\.015\\], .bg-white\\/\\[0\\.01\\], .bg-white\\/\\[0\\.02\\],
          .bg-white\\/\\[0\\.03\\], .bg-white\\/\\[0\\.04\\] {
            background: #f9fafb !important;
          }
          [class*="bg-emerald"] { background: #d1fae5 !important; }
          [class*="bg-amber"] { background: #fef3c7 !important; }
          [class*="bg-red"] { background: #fee2e2 !important; }
          [class*="bg-blue"] { background: #dbeafe !important; }
          [class*="bg-purple"] { background: #ede9fe !important; }
          .text-emerald-300, .text-emerald-400 { color: #059669 !important; }
          .text-amber-300, .text-amber-400 { color: #d97706 !important; }
          .text-red-400 { color: #dc2626 !important; }
          .sticky { position: static !important; }
          .backdrop-blur, .backdrop-blur-sm, .backdrop-blur-xl { backdrop-filter: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
