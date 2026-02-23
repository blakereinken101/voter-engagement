'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserPlus, Check, X, Loader2, Globe } from 'lucide-react'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planFromUrl = searchParams.get('plan')
  const productFromUrl = searchParams.get('product') || (planFromUrl ? 'events' : null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout>(null)

  // Auto-generate slug from org name
  useEffect(() => {
    if (!slugEdited && organizationName) {
      const auto = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50)
      setSlug(auto)
    }
  }, [organizationName, slugEdited])

  // Debounced slug availability check
  const checkSlug = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value || value.length < 3) {
      setSlugStatus('idle')
      setSlugSuggestion(null)
      setSlugError(null)
      return
    }

    setSlugStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(value)}`)
        const data = await res.json()
        if (data.available) {
          setSlugStatus('available')
          setSlugSuggestion(null)
          setSlugError(null)
        } else {
          setSlugStatus('taken')
          setSlugSuggestion(data.suggestion || null)
          setSlugError(data.error || null)
        }
      } catch {
        setSlugStatus('idle')
      }
    }, 400)
  }, [])

  useEffect(() => {
    checkSlug(slug)
  }, [slug, checkSlug])

  async function handleSubmit(e: React.FormEvent) {
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
    if (slugStatus === 'taken') {
      setError('Please choose an available URL')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          organizationName: organizationName.trim(),
          slug,
          product: productFromUrl || undefined,
          plan: planFromUrl || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      if (data.requiresVerification) {
        // Product and plan are now encoded in the vc-2fa-pending JWT by the server
        router.push('/verify-code')
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-32 md:h-40 w-auto mx-auto" priority />
          </Link>
        </div>

        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-vc-purple/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-vc-purple-light" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Create your {productFromUrl === 'relational'
                  ? <span className="text-vc-purple-light">relational</span>
                  : <span className="text-vc-purple-light">events</span>} account
              </h2>
              <p className="text-white/50 text-sm">
                {productFromUrl === 'relational'
                  ? 'Start building your voter contact program'
                  : 'Start organizing events in minutes'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-btn text-white text-sm"
                placeholder="Jane Smith"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-btn text-white text-sm"
                placeholder="jane@example.com"
                required
              />
            </div>

            {/* Password */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 rounded-btn text-white text-sm"
                  placeholder="8+ characters"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Confirm</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 rounded-btn text-white text-sm"
                  placeholder="Repeat password"
                  required
                />
              </div>
            </div>

            {/* Organization Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Organization Name</label>
              <input
                type="text"
                value={organizationName}
                onChange={e => setOrganizationName(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-btn text-white text-sm"
                placeholder="NC Progressives"
                required
              />
            </div>

            {/* Slug / Vanity URL */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Your Events Page URL</label>
              <div className="flex items-center gap-0">
                <span className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 border border-white/10 border-r-0 rounded-l-btn text-white/40 text-sm whitespace-nowrap">
                  <Globe className="w-3.5 h-3.5" />
                  thresholdvote.com/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setSlugEdited(true)
                  }}
                  className="glass-input flex-1 px-3 py-2.5 rounded-l-none rounded-r-btn text-white text-sm"
                  placeholder="your-org-name"
                  required
                />
              </div>

              {/* Slug status indicator */}
              <div className="mt-1.5 min-h-[20px]">
                {slugStatus === 'checking' && (
                  <span className="flex items-center gap-1 text-white/40 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                  </span>
                )}
                {slugStatus === 'available' && (
                  <span className="flex items-center gap-1 text-vc-teal text-xs">
                    <Check className="w-3 h-3" /> thresholdvote.com/{slug} is available
                  </span>
                )}
                {slugStatus === 'taken' && (
                  <div>
                    <span className="flex items-center gap-1 text-vc-coral text-xs">
                      <X className="w-3 h-3" /> {slugError || 'This URL is taken'}
                    </span>
                    {slugSuggestion && (
                      <button
                        type="button"
                        onClick={() => { setSlug(slugSuggestion); setSlugEdited(true) }}
                        className="text-vc-purple-light text-xs hover:underline mt-0.5"
                      >
                        Try &quot;{slugSuggestion}&quot; instead?
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-vc-coral/10 border border-vc-coral/20 rounded-btn px-4 py-2.5 text-vc-coral text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || slugStatus === 'taken'}
              className="w-full bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {planFromUrl && (
            <p className="text-center mt-3 text-xs text-white/40">
              You&apos;ll be able to select the {planFromUrl} plan after creating your account.
            </p>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-white/50">
          Already have an account?{' '}
          <Link href={productFromUrl ? `/sign-in?product=${productFromUrl}` : '/sign-in'} className="text-vc-purple-light font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
}
