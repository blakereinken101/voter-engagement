'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { RSVPStatus } from '@/types/events'
import { Check, HelpCircle, X } from 'lucide-react'

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
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
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
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={guestEmail}
            onChange={e => setGuestEmail(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleRsvp('going')}
              disabled={!guestName.trim() || isLoading}
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

      {error && (
        <p className="text-sm text-vc-coral">{error}</p>
      )}
    </div>
  )
}
