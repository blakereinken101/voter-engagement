'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { UserPlus, AlertCircle } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password, name)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
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
          <p className="text-white/60 text-sm mt-2">Create your volunteer account</p>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-start justify-center px-4 pt-12">
        <div className="w-full max-w-md animate-slide-up">
          <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-vc-slate mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full border border-gray-200 rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
              />
            </div>

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
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="w-full border border-gray-200 rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-vc-slate mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
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
                <span className="animate-pulse">Creating account...</span>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-white/50">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-vc-purple-light font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
