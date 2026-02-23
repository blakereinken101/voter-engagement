'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import EventCoverImage from '@/components/events/EventCoverImage'
import EventTypeChip from '@/components/events/EventTypeChip'
import EventRSVPButton from '@/components/events/EventRSVPButton'
import EventGuestList from '@/components/events/EventGuestList'
import EventReactions from '@/components/events/EventReactions'
import EventCommentThread from '@/components/events/EventCommentThread'
import EventShareButton from '@/components/events/EventShareButton'
import EventCountdown from '@/components/events/EventCountdown'
import type { Event, EventType, RSVPStatus } from '@/types/events'
import { MapPin, Clock, Globe, ExternalLink, Edit, ArrowLeft, Video } from 'lucide-react'
import Link from 'next/link'

function formatFullDate(dateStr: string, endDateStr?: string | null): string {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (endDateStr) {
    const endTime = new Date(endDateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${date} at ${time} — ${endTime}`
  }

  return `${date} at ${time}`
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const slug = params.slug as string

  const [event, setEvent] = useState<Event | null>(null)
  const [userRsvp, setUserRsvp] = useState<{ status: RSVPStatus } | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${slug}`)
        if (res.status === 404) {
          setError('Event not found')
          return
        }
        if (res.status === 401) {
          setError('signin')
          return
        }
        if (!res.ok) {
          setError('Failed to load event')
          return
        }
        const data = await res.json()
        setEvent(data.event)
        setUserRsvp(data.userRsvp)
        setCanManage(data.canManage)
      } catch {
        setError('Failed to load event')
      }
      setIsLoading(false)
    }
    load()
  }, [slug])

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="glass-card animate-pulse">
          <div className="h-[400px] bg-white/5 rounded-t-card" />
          <div className="p-8 space-y-4">
            <div className="h-8 bg-white/5 rounded w-3/4" />
            <div className="h-5 bg-white/5 rounded w-1/2" />
            <div className="h-5 bg-white/5 rounded w-1/3" />
          </div>
        </div>
      </div>
    )
  }

  if (error === 'signin') {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Sign in required</h2>
        <p className="text-white/50 mb-6">This event is only visible to members. Sign in to view it.</p>
        <Link
          href="/sign-in?product=events"
          className="inline-flex bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all"
        >
          Sign In
        </Link>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Event not found</h2>
        <p className="text-white/50 mb-6">This event may have been removed or the link is incorrect.</p>
        <Link
          href="/events"
          className="inline-flex bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium transition-all"
        >
          Browse Events
        </Link>
      </div>
    )
  }

  const isCancelled = event.status === 'cancelled'
  const isPast = new Date(event.startTime) < new Date()

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <div className="px-4 sm:px-6 py-4">
        <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to events
        </Link>
      </div>

      {/* Cover image */}
      <div className="rounded-t-card overflow-hidden mx-4 sm:mx-6">
        <EventCoverImage
          coverImageUrl={event.coverImageUrl}
          emoji={event.emoji}
          themeColor={event.themeColor}
          title={event.title}
          size="hero"
        />
      </div>

      {/* Event content */}
      <div className="mx-4 sm:mx-6 -mt-8 relative z-10">
        <div className="glass-card p-6 sm:p-8 space-y-6">
          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-2">
            <EventTypeChip type={event.eventType as EventType} size="md" />
            {isCancelled && (
              <span className="px-3 py-1 bg-vc-coral/15 border border-vc-coral/30 text-vc-coral text-sm font-medium rounded-full">
                Cancelled
              </span>
            )}
            {isPast && !isCancelled && (
              <span className="px-3 py-1 bg-white/10 border border-white/15 text-white/50 text-sm font-medium rounded-full">
                Past Event
              </span>
            )}
            <EventCountdown startTime={event.startTime} />
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            {event.title}
          </h1>

          {/* Hosted by */}
          {event.organizationName && (
            <p className="text-sm text-white/50">
              Hosted by <span className="text-white/70 font-medium">{event.organizationName}</span>
            </p>
          )}

          {/* Date & Time */}
          <div className="flex items-start gap-3 text-white/80">
            <Clock className="w-5 h-5 text-vc-purple-light shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{formatFullDate(event.startTime, event.endTime)}</p>
              <p className="text-sm text-white/50">{event.timezone?.replace('America/', '').replace('_', ' ')}</p>
            </div>
          </div>

          {/* Location */}
          {event.isVirtual ? (
            <div className="flex items-start gap-3 text-white/80">
              <Video className="w-5 h-5 text-vc-teal shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Virtual Event</p>
                {event.virtualUrl && user && (
                  <a
                    href={event.virtualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-vc-teal hover:underline flex items-center gap-1"
                  >
                    Join link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : event.locationName ? (
            <div className="flex items-start gap-3 text-white/80">
              <MapPin className="w-5 h-5 text-vc-coral shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{event.locationName}</p>
                {event.locationAddress && (
                  <p className="text-sm text-white/50">
                    {event.locationAddress}
                    {event.locationCity && `, ${event.locationCity}`}
                    {event.locationState && `, ${event.locationState}`}
                    {event.locationZip && ` ${event.locationZip}`}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* Visibility badge */}
          {event.visibility !== 'public' && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Globe className="w-4 h-4" />
              <span>{event.visibility === 'org' ? 'Organization members only' : 'Invite only'}</span>
            </div>
          )}

          {/* RSVP Section */}
          {!isCancelled && !isPast && (
            <div className="border-t border-white/10 pt-6">
              <EventRSVPButton
                eventId={event.id}
                currentStatus={userRsvp?.status || null}
                isPublic={event.visibility === 'public'}
                rsvpEnabled={event.rsvpEnabled}
              />
            </div>
          )}

          {/* Guest list */}
          <div className="border-t border-white/10 pt-6">
            <EventGuestList eventId={event.id} counts={event.rsvpCounts} />
          </div>

          {/* Description */}
          {event.description && (
            <div className="border-t border-white/10 pt-6">
              <h2 className="text-sm font-medium text-white/50 mb-2">About This Event</h2>
              <div className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-white/10 pt-6 flex flex-wrap gap-3">
            <EventShareButton slug={event.slug} title={event.title} />
            {canManage && (
              <Link
                href={`/events/${event.slug}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/15 rounded-btn text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
              >
                <Edit className="w-4 h-4" />
                Edit Event
              </Link>
            )}
          </div>

          {/* Reactions */}
          <div className="border-t border-white/10 pt-6">
            <EventReactions eventId={event.id} />
          </div>

          {/* Comments */}
          <div className="border-t border-white/10 pt-6">
            <EventCommentThread eventId={event.id} />
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-16" />
    </div>
  )
}
