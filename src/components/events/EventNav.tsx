'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Calendar, Plus, Settings, CreditCard, LogIn, LogOut, ExternalLink } from 'lucide-react'

export default function EventNav() {
  const { user, organizationSlug, signOut } = useAuth()
  const pathname = usePathname()

  const isActive = (path: string) =>
    pathname === path ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'

  return (
    <nav className="border-b border-white/10 bg-vc-bg/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left: Brand + links */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/events" className="flex items-center gap-2 mr-4">
              <Image src="/logo.png" alt="Threshold" width={120} height={67} className="h-8 w-auto" />
              <span className="font-display font-bold text-white hidden sm:inline">Events</span>
              <span className="hidden md:inline-flex ml-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full">
                For Democrats
              </span>
            </Link>

            <Link
              href="/events"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${isActive('/events')}`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Events</span>
            </Link>

            {user && (
              <>
                <Link
                  href="/events/create"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${isActive('/events/create')}`}
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create</span>
                </Link>

                <Link
                  href="/events/manage"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${isActive('/events/manage')}`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage</span>
                </Link>

                {organizationSlug && (
                  <Link
                    href={`/${organizationSlug}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${isActive(`/${organizationSlug}`)}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">My Page</span>
                  </Link>
                )}
              </>
            )}

            <Link
              href="/events/pricing"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium transition-colors ${
                pathname === '/events/pricing'
                  ? 'text-white bg-white/10'
                  : 'text-vc-teal hover:text-vc-teal hover:bg-vc-teal/10'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Pricing</span>
            </Link>

          </div>

          {/* Right: Auth */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
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
            ) : (
              <Link
                href="/sign-in?product=events"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
