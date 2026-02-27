'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MessageSquare, LayoutDashboard, LogOut, Users, Calendar } from 'lucide-react'

export default function TextingNav() {
  const { user, signOut, hasEventsAccess, hasRelationalAccess } = useAuth()
  const pathname = usePathname()

  const isActive = (path: string) =>
    pathname.startsWith(path) ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'

  return (
    <nav className="border-b border-white/10 bg-vc-bg/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/texting" className="flex items-center gap-2 mr-4">
              <Image src="/logo.png" alt="Threshold" width={120} height={67} className="h-8 w-auto" />
              <span className="inline-flex ml-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                Texting
              </span>
            </Link>

            {user && (
              <>
                <Link
                  href="/texting"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${
                    pathname === '/texting' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">My Texts</span>
                </Link>

                <Link
                  href="/texting/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${isActive('/texting/admin')}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Campaigns</span>
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center gap-3">
                {hasRelationalAccess && (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium text-vc-purple-light hover:bg-vc-purple/10 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Relational</span>
                  </Link>
                )}
                {hasEventsAccess && (
                  <Link
                    href="/events/manage"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium text-vc-teal hover:bg-vc-teal/10 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="hidden sm:inline">Events</span>
                  </Link>
                )}
                <div className="w-8 h-8 rounded-full bg-amber-500/30 ring-2 ring-amber-500/50 flex items-center justify-center text-xs font-bold text-white">
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
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
