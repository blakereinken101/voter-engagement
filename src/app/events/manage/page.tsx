'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSearchParams } from 'next/navigation'
import EventManageTable from '@/components/events/EventManageTable'
import type { Event } from '@/types/events'
import { FREE_EVENT_LIMIT } from '@/types/events'
import { Plus, Lock, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function EventManageContent() {
  const { user, isLoading: authLoading, hasEventsSubscription, freeEventsUsed, freeEventsRemaining } = useAuth()
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'cancelled'>('all')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const didCheckoutRef = useRef(false)

  // Auto-trigger Stripe checkout if redirected here after signup with a plan
  useEffect(() => {
    const checkoutPlan = searchParams.get('checkout')
    if (!user || !checkoutPlan || didCheckoutRef.current) return
    if (checkoutPlan !== 'grassroots' && checkoutPlan !== 'growth') return

    didCheckoutRef.current = true
    setCheckoutLoading(true)

    fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: checkoutPlan }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          window.location.href = data.url
        } else {
          console.error('No checkout URL returned:', data.error)
          setCheckoutLoading(false)
        }
      })
      .catch(() => setCheckoutLoading(false))
  }, [user, searchParams])

  useEffect(() => {
    if (user) fetchEvents()
  }, [user])

  async function fetchEvents() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      // Don't filter by status so we can see all statuses
      const res = await fetch(`/api/events?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch { /* ignore */ }
    setIsLoading(false)
  }

  async function handleDelete(eventId: string) {
    if (!confirm('Are you sure you want to delete this event?')) return
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
      }
    } catch { /* ignore */ }
  }

  async function handleDuplicate(eventId: string) {
    const original = events.find(e => e.id === eventId)
    if (!original) return

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${original.title} (Copy)`,
          description: original.description,
          eventType: original.eventType,
          startTime: original.startTime,
          endTime: original.endTime,
          timezone: original.timezone,
          locationName: original.locationName,
          locationAddress: original.locationAddress,
          locationCity: original.locationCity,
          locationState: original.locationState,
          locationZip: original.locationZip,
          isVirtual: original.isVirtual,
          virtualUrl: original.virtualUrl,
          coverImageUrl: original.coverImageUrl,
          emoji: original.emoji,
          themeColor: original.themeColor,
          visibility: original.visibility,
          maxAttendees: original.maxAttendees,
          rsvpEnabled: original.rsvpEnabled,
          status: 'draft',
        }),
      })
      if (res.ok) {
        await fetchEvents()
      }
    } catch { /* ignore */ }
  }

  if (authLoading || checkoutLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-pulse">
          {checkoutLoading && (
            <p className="text-white/70 text-center mb-4">Redirecting to checkout...</p>
          )}
          <div className="h-8 bg-white/5 rounded w-1/4 mb-4" />
          <div className="h-64 bg-white/5 rounded" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Lock className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-white mb-2">Sign in to manage events</h2>
        <p className="text-white/50 mb-6">You need an account to manage events.</p>
        <Link
          href="/sign-in?product=events"
          className="inline-flex bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all"
        >
          Sign In
        </Link>
      </div>
    )
  }

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.status === filter)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Manage Events</h1>
          <p className="text-white/50 mt-1">View and manage all your events</p>
        </div>
        <Link
          href="/events/create"
          className="inline-flex items-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white px-5 py-2.5 rounded-btn font-medium shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Link>
      </div>

      {/* Subscription status */}
      {!hasEventsSubscription && (
        <div className="glass-card p-4 mb-6 border-vc-purple/20 bg-vc-purple/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">
              Free plan &mdash; {freeEventsUsed} of {FREE_EVENT_LIMIT} events used
            </p>
            <p className="text-xs text-white/50 mt-0.5">Upgrade for unlimited events, analytics, and custom branding</p>
          </div>
          <Link
            href="/events/pricing"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-vc-purple hover:bg-vc-purple-light text-white text-sm font-medium rounded-btn shadow-glow transition-all shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Upgrade
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-btn w-fit">
        {(['all', 'published', 'draft', 'cancelled'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-btn text-sm font-medium transition-all ${
              filter === f
                ? 'bg-vc-purple/20 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                ({events.filter(e => e.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="glass-card p-8 animate-pulse">
          <div className="h-64 bg-white/5 rounded" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <EventManageTable
            events={filteredEvents}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </div>
      )}
    </div>
  )
}

export default function EventManagePage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-pulse">
          <div className="h-8 bg-white/5 rounded w-1/4 mb-4" />
          <div className="h-64 bg-white/5 rounded" />
        </div>
      </div>
    }>
      <EventManageContent />
    </Suspense>
  )
}
