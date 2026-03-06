'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MessageCircle, Users, Calendar, LogOut, Megaphone } from 'lucide-react'

export default function MessagingNav() {
  const { user, signOut, isAdmin, hasEventsAccess, hasRelationalAccess, hasTextingAccess } = useAuth()
  const pathname = usePathname()

  const isActive = (path: string) =>
    pathname.startsWith(path) ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'

  return (
    <nav className="border-b border-white/10 bg-vc-bg/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/messaging" className="flex items-center gap-2 mr-4">
              <Image src="/logo.png" alt="Threshold" width={120} height={67} className="h-8 w-auto" />
              <span className="inline-flex ml-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                Messages
              </span>
            </Link>

            {user && (
              <>
                <Link
                  href="/messaging"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${
                    pathname === '/messaging' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Channels</span>
                </Link>

                {isAdmin && (
                  <Link
                    href="/messaging/broadcast"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${isActive('/messaging/broadcast')}`}
                  >
                    <Megaphone className="w-4 h-4" />
                    <span className="hidden sm:inline">Broadcast</span>
                  </Link>
                )}
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
                {hasTextingAccess && (
                  <Link
                    href="/texting"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Texting</span>
                  </Link>
                )}
                <div className="w-8 h-8 rounded-full bg-blue-500/30 ring-2 ring-blue-500/50 flex items-center justify-center text-xs font-bold text-white">
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
