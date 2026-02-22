'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface InviteDetails {
  campaignName: string
  candidateName: string
  orgName: string
  inviterName: string
  role: string
  email: string | null
  state: string
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const { user } = useAuth()

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // New account fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetch(`/api/invitations/accept?token=${token}`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error) })
        return res.json()
      })
      .then(data => {
        setInvite(data.invitation)
        if (data.invitation.email) setEmail(data.invitation.email)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user) {
      // New account validation
      if (!name.trim()) { setError('Name is required'); return }
      if (!email.trim()) { setError('Email is required'); return }
      if (password.length < 8) { setError('Password must be at least 8 characters'); return }
      if (password !== confirmPassword) { setError('Passwords do not match'); return }
    }

    setSubmitting(true)

    try {
      const body: Record<string, string> = { token }
      if (!user) {
        body.name = name
        body.email = email
        body.password = password
      }

      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.existingUser) {
          setError('An account with this email already exists. Please sign in first, then come back to this link.')
          return
        }
        throw new Error(data.error || 'Failed to accept invitation')
      }

      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setSubmitting(false)
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    volunteer: 'Volunteer',
    organizer: 'Organizer',
    campaign_admin: 'Campaign Admin',
    org_owner: 'Organization Owner',
  }

  if (loading) {
    return (
      <div className="cosmic-bg constellation min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-40 w-auto mx-auto mb-8" priority />
          <div className="glass-card p-8">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Invalid Invitation</h2>
            <p className="text-white/60 text-sm mb-6">{error}</p>
            <Link href="/sign-in" className="text-vc-purple-light font-bold hover:underline">
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="glass-card p-8">
            <CheckCircle className="w-12 h-12 text-vc-teal mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Welcome aboard!</h2>
            <p className="text-white/60 text-sm">
              You&apos;ve joined <span className="text-white font-bold">{invite?.campaignName}</span> as a {ROLE_LABELS[invite?.role || 'volunteer']}.
            </p>
            <p className="text-white/40 text-xs mt-4">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-40 w-auto mx-auto mb-4" priority />
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Invited</h1>
          <p className="text-white/60 text-sm">
            <span className="text-white font-bold">{invite?.inviterName}</span> has invited you to join
          </p>
          <p className="text-vc-purple-light font-bold text-lg mt-1">{invite?.campaignName}</p>
          <p className="text-white/40 text-xs mt-1">
            as {ROLE_LABELS[invite?.role || 'volunteer']} | {invite?.state}
          </p>
        </div>

        <form onSubmit={handleAccept} className="glass-card p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {user ? (
            <div className="text-center py-4">
              <p className="text-white/70 text-sm">Signed in as</p>
              <p className="text-white font-bold">{user.name}</p>
              <p className="text-white/50 text-xs">{user.email}</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your full name" required
                  className="glass-input w-full rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  readOnly={!!invite?.email}
                  className="glass-input w-full rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" required minLength={8}
                  className="glass-input w-full rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Confirm Password</label>
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password" required minLength={8}
                  className="glass-input w-full rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
                />
              </div>
            </>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-3 rounded-btn shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 font-display text-lg flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span className="animate-pulse">Joining...</span>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                {user ? 'Join Campaign' : 'Create Account & Join'}
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-white/50">
          Already have an account?{' '}
          <Link href={`/sign-in?redirect=/invite/${token}`} className="text-vc-purple-light font-bold hover:underline">
            Sign in first
          </Link>
        </p>
      </div>
    </div>
  )
}
