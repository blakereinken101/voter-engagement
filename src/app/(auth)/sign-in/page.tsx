'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { LogIn, AlertCircle } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const redirectTo = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('redirect')
  }, [])
  const { signIn, user, isLoading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already signed in, redirect to dashboard or redirect URL
  useEffect(() => {
    if (!authLoading && user) {
      router.push(redirectTo || '/dashboard')
    }
  }, [authLoading, user, router, redirectTo])

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
      const result = await signIn(email, password)
      if (result?.requiresVerification) {
        router.push('/verify-code')
        return
      }
      router.push(redirectTo || '/dashboard')
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
          <p className="text-white/60 text-sm mt-3">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
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
          Forgot password? Contact your campaign admin for a reset.
        </p>
        <p className="text-center mt-3 text-sm text-white/50">
          Need an account? Ask your campaign admin for an invite link.
        </p>
      </div>
    </div>
  )
}
