'use client'

import { useState, useEffect } from 'react'
import EventCard from '@/components/events/EventCard'
import EventFilters from '@/components/events/EventFilters'
import type { Event } from '@/types/events'
import { Calendar, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function EventsDiscoveryPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchEvents()
  }, [selectedType])

  async function fetchEvents() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedType) params.set('type', selectedType)
      params.set('status', 'published')
      params.set('limit', '50')

      const res = await fetch(`/api/events?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch { /* ignore */ }
    setIsLoading(false)
  }

  // Client-side search filter
  const filteredEvents = events.filter(e => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      e.title.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.locationCity?.toLowerCase().includes(q) ||
      e.locationName?.toLowerCase().includes(q)
    )
  })

  // Split into upcoming and past
  const now = new Date().toISOString()
  const upcoming = filteredEvents.filter(e => e.startTime >= now)
  const past = filteredEvents.filter(e => e.startTime < now)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vc-purple/10 border border-vc-purple/20 text-vc-purple-light text-sm mb-4">
          <Sparkles className="w-4 h-4" />
          <span>Power the Progressive Movement</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-3">
          Organize. Activate. <span className="text-gradient">Win.</span>
        </h1>
        <p className="text-white/50 max-w-lg mx-auto">
          Join canvassing shifts, phone banks, rallies, and voter registration drives.
          Every door knocked and every call made brings us closer to victory.
        </p>
        {user && (
          <Link
            href="/events/create"
            className="inline-flex items-center gap-2 mt-6 bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all"
          >
            <Calendar className="w-4 h-4" />
            Create Event
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="mb-8">
        <EventFilters
          selectedType={selectedType}
          searchQuery={searchQuery}
          onTypeChange={setSelectedType}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card animate-pulse">
              <div className="h-[200px] bg-white/5 rounded-t-card" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-white/5 rounded w-20" />
                <div className="h-6 bg-white/5 rounded w-3/4" />
                <div className="h-4 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming events */}
      {!isLoading && upcoming.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-display font-bold text-white mb-4">
            Upcoming Events ({upcoming.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Past events */}
      {!isLoading && past.length > 0 && (
        <section>
          <h2 className="text-lg font-display font-bold text-white/50 mb-4">
            Past Events
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
            {past.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!isLoading && filteredEvents.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">✊</div>
          <h3 className="text-xl font-display font-bold text-white mb-2">No events found</h3>
          <p className="text-white/50 mb-6">
            {searchQuery || selectedType ? 'Try adjusting your filters' : 'Be the first to create one!'}
          </p>
          {user && (
            <Link
              href="/events/create"
              className="inline-flex items-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all"
            >
              Create Event
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
