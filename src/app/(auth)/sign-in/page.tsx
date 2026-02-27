'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { LogIn, AlertCircle, CheckCircle, Calendar, Users, MessageSquare, Loader2 } from 'lucide-react'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const productFromUrl = searchParams.get('product')
  const wasReset = searchParams.get('reset') === 'true'

  // Read return-url cookie set by middleware (where user was trying to go)
  const returnUrl = useMemo(() => {
    if (typeof window === 'undefined') return null
    const match = document.cookie.match(/(?:^|;\s*)vc-return-url=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  const { signIn, user, isLoading: authLoading, hasRelationalAccess, hasEventsAccess, hasTextingAccess } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already signed in, redirect based on return URL > URL params > product access
  useEffect(() => {
    if (!authLoading && user) {
      let dest = redirectTo || returnUrl
      if (!dest) {
        if (productFromUrl === 'texting') {
          dest = '/texting'
        } else if (productFromUrl === 'events') {
          dest = '/events/manage'
        } else if (hasTextingAccess && productFromUrl !== 'relational') {
          dest = '/texting'
        } else if (hasRelationalAccess) {
          dest = '/dashboard'
        } else if (hasEventsAccess) {
          dest = '/events/manage'
        } else {
          dest = '/dashboard'
        }
      }
      // Clear the return-url cookie
      document.cookie = 'vc-return-url=; Path=/; SameSite=Lax; Max-Age=0'
      // Hard navigate to avoid stale AuthContext state after login
      window.location.href = dest
    }
  }, [authLoading, user, redirectTo, returnUrl, productFromUrl, hasRelationalAccess, hasEventsAccess, hasTextingAccess])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!password) {
      setError('Password is required')
      return
    }

    setLoading(true)

    try {
      // Pass product so the server encodes it into the 2FA pending JWT
      const result = await signIn(email, password, productFromUrl || undefined)
      if (result?.requiresVerification) {
        router.push(productFromUrl ? `/verify-code?product=${productFromUrl}` : '/verify-code')
        return
      }
      const dest = redirectTo || returnUrl || (productFromUrl === 'texting' ? '/texting' : productFromUrl === 'events' ? '/events/manage' : '/dashboard')
      document.cookie = 'vc-return-url=; Path=/; SameSite=Lax; Max-Age=0'
      router.push(dest)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      // Provide more user-friendly error messages
      if (msg.includes('Internal server error') || msg.includes('500')) {
        setError('Something went wrong. Please try again in a moment.')
      } else if (msg.includes('Invalid email or password')) {
        setError('Invalid email or password. Please check your credentials and try again.')
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('Unable to connect. Please check your internet connection and try again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-48 md:h-64 w-auto mx-auto" priority />
          </Link>
          {productFromUrl === 'texting' ? (
            <div className="flex items-center justify-center gap-2 mt-3">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <p className="text-white/60 text-sm">Sign in to <span className="text-amber-400 font-semibold">Texting</span></p>
            </div>
          ) : productFromUrl === 'relational' ? (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Users className="w-4 h-4 text-vc-purple-light" />
              <p className="text-white/60 text-sm">Sign in to <span className="text-vc-purple-light font-semibold">Relational</span></p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Calendar className="w-4 h-4 text-vc-teal" />
              <p className="text-white/60 text-sm">Sign in to the <span className="text-vc-teal font-semibold">Events</span> platform</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
          {wasReset && (
            <div className="flex items-center gap-2 bg-vc-teal/20 text-vc-teal text-sm px-4 py-3 rounded-lg border border-vc-teal/30">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Password reset successfully! Sign in with your new password.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="glass-input w-full rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="glass-input w-full rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-3 rounded-btn shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 font-display text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">Signing in...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-white/40">
          <Link href="/forgot-password" className="text-vc-purple-light hover:underline">
            Forgot your password?
          </Link>
        </p>
        <p className="text-center mt-3 text-sm text-white/50">
          {productFromUrl === 'texting' ? (
            <>Need access? Ask your texting campaign admin for an invite link.</>
          ) : productFromUrl === 'relational' ? (
            <>Need an account? Ask your campaign admin for an invite link.</>
          ) : (
            <>Need an events account?{' '}
              <Link href="/sign-up?product=events" className="text-vc-teal font-bold hover:underline">
                Sign up
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
