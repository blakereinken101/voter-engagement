'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { RSVPStatus } from '@/types/events'
import Link from 'next/link'
import { Check, HelpCircle, X, Phone } from 'lucide-react'

interface Props {
  eventId: string
  currentStatus: RSVPStatus | null
  isPublic: boolean
  rsvpEnabled: boolean
  onRsvpChange?: (status: RSVPStatus) => void
}

export default function EventRSVPButton({ eventId, currentStatus, isPublic, rsvpEnabled, onRsvpChange }: Props) {
  const { user } = useAuth()
  const [status, setStatus] = useState<RSVPStatus | null>(currentStatus)
  const [isLoading, setIsLoading] = useState(false)
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [showSmsForm, setShowSmsForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')

  if (!rsvpEnabled) return null

  async function handleRsvp(newStatus: RSVPStatus) {
    if (!user && !isPublic) {
      window.location.href = '/sign-in?product=events'
      return
    }

    if (!user && isPublic && !showGuestForm) {
      setShowGuestForm(true)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = { status: newStatus }
      if (!user) {
        body.guestName = guestName
        body.guestEmail = guestEmail
        if (phoneNumber.trim()) {
          body.guestPhone = phoneNumber.trim()
          body.smsOptIn = true
        }
      } else {
        if (phoneNumber.trim()) {
          body.phone = phoneNumber.trim()
          body.smsOptIn = true
        }
      }

      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to RSVP')
        return
      }

      setStatus(newStatus)
      setShowGuestForm(false)
      onRsvpChange?.(newStatus)
    } catch {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const buttons: { key: RSVPStatus; label: string; icon: React.ReactNode; activeClass: string }[] = [
    { key: 'going', label: 'Going', icon: <Check className="w-4 h-4" />, activeClass: 'bg-vc-teal text-white shadow-glow-teal' },
    { key: 'maybe', label: 'Maybe', icon: <HelpCircle className="w-4 h-4" />, activeClass: 'bg-vc-gold text-white shadow-glow-gold' },
    { key: 'not_going', label: "Can't Go", icon: <X className="w-4 h-4" />, activeClass: 'bg-white/10 text-white/60' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {buttons.map(btn => (
          <button
            key={btn.key}
            onClick={() => handleRsvp(btn.key)}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-btn font-medium text-sm transition-all duration-200 ${
              status === btn.key
                ? btn.activeClass
                : 'bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>

      {/* Guest RSVP form for unauthenticated users on public events */}
      {showGuestForm && !user && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <p className="text-sm text-white/70">Enter your info to RSVP</p>
          <input
            type="text"
            placeholder="Your name *"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            placeholder="Email *"
            value={guestEmail}
            onChange={e => setGuestEmail(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm"
            required
          />
          <input
            type="tel"
            placeholder="Phone number *"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm"
            required
          />
          <p className="text-[11px] text-white/40 leading-relaxed">
            By RSVPing you agree to receive text reminders and updates about this event. Msg &amp; data rates may apply. Reply STOP to unsubscribe. See our{' '}
            <Link href="/terms" target="_blank" className="text-vc-purple-light hover:underline">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="text-vc-purple-light hover:underline">Privacy Policy</Link>.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleRsvp('going')}
              disabled={!guestName.trim() || !guestEmail.trim() || !phoneNumber.trim() || isLoading}
              className="flex-1 bg-vc-teal text-white px-4 py-2 rounded-btn text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Confirm RSVP'}
            </button>
            <button
              onClick={() => setShowGuestForm(false)}
              className="px-4 py-2 text-white/60 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phone number input for authenticated users who just RSVP'd going/maybe */}
      {user && status && (status === 'going' || status === 'maybe') && !showSmsForm && (
        <button
          onClick={() => setShowSmsForm(true)}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          <Phone className="w-3 h-3" />
          Add phone for text reminders
        </button>
      )}

      {user && showSmsForm && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <p className="text-sm text-white/70 flex items-center gap-1.5">
            <Phone className="w-4 h-4" />
            Add your phone for text reminders
          </p>
          <input
            type="tel"
            placeholder="Phone number"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-white/40 leading-relaxed">
            By adding your number you agree to receive text reminders about this event. Msg &amp; data rates may apply. Reply STOP to unsubscribe.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { if (status) handleRsvp(status) }}
              disabled={!phoneNumber.trim() || isLoading}
              className="flex-1 bg-vc-teal text-white px-4 py-2 rounded-btn text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowSmsForm(false)}
              className="px-4 py-2 text-white/60 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-vc-coral">{error}</p>
      )}
    </div>
  )
}
