'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react'

function VerifyCodeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const product = searchParams.get('product')
  const { verifyCode, resendCode, user } = useAuth()
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const didRedirectRef = useRef(false)

  // If already signed in, redirect to dashboard
  useEffect(() => {
    if (user && !didRedirectRef.current) {
      didRedirectRef.current = true
      router.push(product === 'texting' ? '/texting' : product === 'events' ? '/events/manage' : '/dashboard')
    }
  }, [user, router, product])

  // Start cooldown timer on mount (just sent a code)
  useEffect(() => {
    setResendCooldown(60)
  }, [])

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleSubmit = useCallback(async (code: string) => {
    if (code.length !== 6) return
    setError('')
    setLoading(true)
    try {
      // Server returns the redirect URL computed from the JWT claims
      const redirect = await verifyCode(code)
      didRedirectRef.current = true
      // Hard navigate (not router.push) to guarantee a fresh page load with
      // clean AuthContext state — same pattern as signOut. This prevents stale
      // userProducts from causing redirect loops.
      window.location.href = redirect || (product === 'texting' ? '/texting' : product === 'events' ? '/events/manage' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      // Clear inputs on error
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      setLoading(false)
    }
  }, [verifyCode, product])

  function handleDigitChange(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)

    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits filled
    const fullCode = newDigits.join('')
    if (fullCode.length === 6) {
      handleSubmit(fullCode)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return

    const newDigits = [...digits]
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i]
    }
    setDigits(newDigits)

    const nextEmpty = pasted.length < 6 ? pasted.length : 5
    inputRefs.current[nextEmpty]?.focus()

    if (pasted.length === 6) {
      handleSubmit(pasted)
    }
  }

  async function handleResend() {
    setError('')
    setResendMessage('')
    try {
      await resendCode()
      setResendCooldown(60)
      setResendMessage('New code sent!')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-48 md:h-64 w-auto mx-auto" priority />
          </Link>
          <p className="text-white/60 text-sm mt-3">Check your email for a verification code</p>
        </div>

        <div className="glass-card p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-vc-purple/20 ring-2 ring-vc-purple/40 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-vc-purple-light" />
            </div>
            <h2 className="text-lg font-bold text-white">Enter verification code</h2>
            <p className="text-white/50 text-sm mt-1">We sent a 6-digit code to your email</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {resendMessage && (
            <div className="bg-vc-teal/20 text-vc-teal text-sm px-4 py-3 rounded-lg border border-vc-teal/30 text-center">
              {resendMessage}
            </div>
          )}

          {/* 6-digit code input */}
          <div className="flex justify-center gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={loading}
                className="w-12 h-14 text-center text-2xl font-bold font-mono glass-input rounded-btn text-white focus:ring-2 focus:ring-vc-purple/50 focus:border-vc-purple outline-none transition-all disabled:opacity-50"
              />
            ))}
          </div>

          <button
            onClick={() => handleSubmit(digits.join(''))}
            disabled={loading || digits.join('').length !== 6}
            className="w-full bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-3 rounded-btn shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 font-display text-lg"
          >
            {loading ? (
              <span className="animate-pulse">Verifying...</span>
            ) : (
              'Verify'
            )}
          </button>

          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm text-white/50 hover:text-white transition-colors disabled:text-white/20 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'
              }
            </button>
          </div>
        </div>

        <Link
          href={product === 'texting' ? '/sign-in?product=texting' : product === 'events' ? '/sign-in?product=events' : '/sign-in'}
          className="flex items-center justify-center gap-2 mt-6 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={
      <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    }>
      <VerifyCodeForm />
    </Suspense>
  )
}
