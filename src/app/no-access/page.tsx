'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { ShieldAlert, ArrowRight, LogOut, Calendar, Users } from 'lucide-react'

function NoAccessContent() {
  const searchParams = useSearchParams()
  const { user, signOut, hasEventsAccess, hasRelationalAccess } = useAuth()
  const wanted = searchParams.get('product') // 'events' or 'relational'

  const wantedEvents = wanted === 'events'
  const wantedRelational = wanted === 'relational' || !wanted

  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-32 md:h-40 w-auto mx-auto" priority />
          </Link>
        </div>

        <div className="glass-card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-vc-coral/20 ring-2 ring-vc-coral/40 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-7 h-7 text-vc-coral" />
          </div>

          {wantedRelational ? (
            <>
              <h2 className="text-xl font-bold text-white mb-3">
                {hasEventsAccess ? "You're signed into Events" : "No access to Relational"}
              </h2>
              <p className="text-white/60 text-sm mb-2">
                {hasEventsAccess
                  ? "Your account has access to the Events platform, but the Relational organizing tool requires a separate campaign invitation."
                  : "The Relational organizing tool requires a campaign invitation to access."
                }
              </p>
              <p className="text-white/40 text-xs mb-6">
                Ask your campaign admin for an invite link, or switch to the product you have access to.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-3">
                {hasRelationalAccess ? "You're signed into Relational" : "No access to Events"}
              </h2>
              <p className="text-white/60 text-sm mb-2">
                {hasRelationalAccess
                  ? "Your account has access to the Relational organizing tool, but you don't have an Events account yet."
                  : "You don't have access to the Events platform yet."
                }
              </p>
              <p className="text-white/40 text-xs mb-6">
                Create an events account to start organizing events, or switch to the product you have access to.
              </p>
            </>
          )}

          <div className="space-y-3">
            {/* Primary action: go to the product they DO have */}
            {hasEventsAccess && (
              <Link
                href="/events/manage"
                className="w-full flex items-center justify-center gap-2 bg-vc-teal hover:bg-vc-teal/80 text-white font-bold py-3 px-6 rounded-btn transition-all"
              >
                <Calendar className="w-5 h-5" />
                Go to Events
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            {hasRelationalAccess && (
              <Link
                href="/dashboard"
                className="w-full flex items-center justify-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-3 px-6 rounded-btn transition-all"
              >
                <Users className="w-5 h-5" />
                Go to Relational
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            {/* Secondary: sign up for the product they DON'T have */}
            {wantedEvents && !hasEventsAccess && (
              <Link
                href="/sign-up?product=events"
                className="w-full flex items-center justify-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-3 px-6 rounded-btn transition-all"
              >
                Create Events Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            {/* Sign out option */}
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 glass text-white/60 hover:text-white font-medium py-3 px-6 rounded-btn transition-all hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
              Sign out and use a different account
            </button>
          </div>
        </div>

        {user && (
          <p className="text-center mt-4 text-xs text-white/30">
            Signed in as {user.email}
          </p>
        )}
      </div>
    </div>
  )
}

export default function NoAccessPage() {
  return (
    <Suspense fallback={
      <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    }>
      <NoAccessContent />
    </Suspense>
  )
}
