'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { KeyRound, AlertCircle, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'code' | 'password' | 'success'>('code')

  // Code entry state
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [resendCooldown, setResendCooldown] = useState(60)
  const [resendMessage, setResendMessage] = useState('')

  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Shared state
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  // Auto-focus first code input
  useEffect(() => {
    if (step === 'code') {
      inputRefs.current[0]?.focus()
    }
  }, [step])

  // Redirect to sign-in after success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => router.push('/sign-in?reset=true'), 2000)
      return () => clearTimeout(timer)
    }
  }, [step, router])

  // ── Code verification ─────────────────────────────────────────

  const handleSubmitCode = useCallback(async (code: string) => {
    if (code.length !== 6) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setStep('password')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }, [])

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    const fullCode = newDigits.join('')
    if (fullCode.length === 6) {
      handleSubmitCode(fullCode)
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
      handleSubmitCode(pasted)
    }
  }

  async function handleResend() {
    setError('')
    setResendMessage('')
    try {
      const res = await fetch('/api/auth/resend-reset-code', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend code')
      setResendCooldown(60)
      setResendMessage('New code sent!')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  // ── Set new password ──────────────────────────────────────────

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/set-new-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-48 md:h-64 w-auto mx-auto" priority />
          </Link>
          <p className="text-white/60 text-sm mt-3">
            {step === 'code' && 'Check your email for a reset code'}
            {step === 'password' && 'Set your new password'}
            {step === 'success' && 'You\'re all set!'}
          </p>
        </div>

        {/* Step 1: Code entry */}
        {step === 'code' && (
          <div className="glass-card p-8 space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-vc-purple/20 ring-2 ring-vc-purple/40 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-vc-purple-light" />
              </div>
              <h2 className="text-lg font-bold text-white">Enter reset code</h2>
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
              onClick={() => handleSubmitCode(digits.join(''))}
              disabled={loading || digits.join('').length !== 6}
              className="w-full bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-3 rounded-btn shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 font-display text-lg"
            >
              {loading ? (
                <span className="animate-pulse">Verifying...</span>
              ) : (
                'Verify Code'
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
        )}

        {/* Step 2: New password */}
        {step === 'password' && (
          <form onSubmit={handleSubmitPassword} className="glass-card p-8 space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-vc-purple/20 ring-2 ring-vc-purple/40 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-7 h-7 text-vc-purple-light" />
              </div>
              <h2 className="text-lg font-bold text-white">Set new password</h2>
              <p className="text-white/50 text-sm mt-1">Choose a strong password (8+ characters)</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-white/70 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
                className="glass-input w-full rounded-btn h-11 px-4 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
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
                <span className="animate-pulse">Resetting...</span>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  Reset Password
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="glass-card p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-vc-teal/20 ring-2 ring-vc-teal/40 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-vc-teal" />
            </div>
            <h2 className="text-lg font-bold text-white">Password reset!</h2>
            <p className="text-white/50 text-sm">Redirecting you to sign in...</p>
          </div>
        )}

        {step !== 'success' && (
          <Link
            href="/sign-in"
            className="flex items-center justify-center gap-2 mt-6 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        )}
      </div>
    </div>
  )
}
