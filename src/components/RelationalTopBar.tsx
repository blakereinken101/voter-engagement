'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { LogOut, ArrowLeft } from 'lucide-react'

export default function RelationalTopBar() {
  const { user, signOut } = useAuth()

  if (!user) return null

  return (
    <nav className="border-b border-white/10 bg-vc-bg/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Threshold" width={120} height={67} className="h-8 w-auto" />
              <span className="font-display font-bold text-white hidden sm:inline">Relational</span>
            </Link>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-vc-purple/20 text-vc-purple-light border border-vc-purple/30 rounded-full">
              Relational
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="w-8 h-8 rounded-full bg-vc-purple/30 ring-2 ring-vc-purple/50 flex items-center justify-center text-xs font-bold text-white">
              {user.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
