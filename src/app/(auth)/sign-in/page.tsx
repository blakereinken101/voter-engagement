'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { LogIn, AlertCircle } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={220} height={123} className="h-14 w-auto mx-auto" priority />
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
          Forgot password? Contact your admin.
        </p>
        <p className="text-center mt-3 text-sm text-white/50">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-vc-purple-light font-bold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
