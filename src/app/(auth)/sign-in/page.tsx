'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
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
    <div className="min-h-screen bg-vc-bg flex flex-col text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-vc-purple-dark via-vc-purple to-vc-purple-light py-8">
        <div className="max-w-md mx-auto px-4 text-center">
          <Link href="/" className="font-display font-extrabold text-3xl text-white tracking-tight hover:opacity-80 transition-opacity">
            VoteCircle
          </Link>
          <p className="text-white/60 text-sm mt-2">Sign in to your account</p>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-start justify-center px-4 pt-12">
        <div className="w-full max-w-md animate-slide-up">
          <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-vc-slate mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-gray-200 rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-vc-slate mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full border border-gray-200 rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
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

          <p className="text-center mt-8 text-sm text-white/50">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-vc-purple-light font-bold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
