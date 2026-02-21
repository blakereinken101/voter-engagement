'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

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
    <div className="min-h-screen bg-rally-cream flex flex-col">
      {/* Header */}
      <header className="bg-rally-navy py-6">
        <div className="max-w-md mx-auto px-4 text-center">
          <Link href="/" className="font-display font-bold text-2xl text-white hover:text-rally-yellow transition-colors">
            VoteCircle
          </Link>
          <p className="text-white/50 text-sm mt-1">Create your volunteer account</p>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-start justify-center px-4 pt-12">
        <div className="w-full max-w-md">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-5">
            {error && (
              <div className="bg-rally-red/10 text-rally-red text-sm px-4 py-3 rounded-lg font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rally-slate-light mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rally-red focus:border-transparent outline-none transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rally-slate-light mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rally-red focus:border-transparent outline-none transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rally-slate-light mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rally-red focus:border-transparent outline-none transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rally-slate-light mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rally-red focus:border-transparent outline-none transition-shadow"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rally-red hover:bg-rally-red-light text-white font-bold py-3.5 rounded-lg shadow-lg shadow-rally-red/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-display text-lg"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-rally-slate-light">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-rally-red font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
