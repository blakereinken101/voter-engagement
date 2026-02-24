'use client'

import Link from 'next/link'
import EventCoverImage from './EventCoverImage'
import EventTypeChip from './EventTypeChip'
import type { Event, EventType } from '@/types/events'
import { MapPin, Clock, Users } from 'lucide-react'

interface Props {
  event: Event
}

function formatEventDate(dateStr: string, timezone?: string): string {
  const d = new Date(dateStr)
  const tzOpts = timezone ? { timeZone: timezone } : {}
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const eventDateStr = d.toLocaleDateString('en-US', tzOpts)
  const nowDateStr = now.toLocaleDateString('en-US', tzOpts)
  const tomorrowDateStr = tomorrow.toLocaleDateString('en-US', tzOpts)

  const isToday = eventDateStr === nowDateStr
  const isTomorrow = eventDateStr === tomorrowDateStr

  if (isToday) return `Today at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...tzOpts })}`
  if (isTomorrow) return `Tomorrow at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...tzOpts })}`

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...tzOpts,
  })
}

export default function EventCard({ event }: Props) {
  const goingCount = event.rsvpCounts?.going || 0

  return (
    <Link href={`/events/${event.slug}`} className="block group">
      <div className="glass-card overflow-hidden transition-all duration-300 hover:shadow-glow hover:-translate-y-1">
        {/* Cover image */}
        <EventCoverImage
          coverImageUrl={event.coverImageUrl}
          emoji={event.emoji}
          themeColor={event.themeColor}
          title={event.title}
          size="card"
        />

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Type chip */}
          <EventTypeChip type={event.eventType as EventType} />

          {/* Title */}
          <h3 className="font-display font-bold text-lg text-white group-hover:text-vc-purple-light transition-colors line-clamp-2">
            {event.title}
          </h3>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Clock className="w-4 h-4 shrink-0" />
            <span>{formatEventDate(event.startTime, event.timezone)}</span>
          </div>

          {/* Location */}
          {(event.locationName || event.isVirtual) && (
            <div className="flex items-center gap-2 text-sm text-white/60">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {event.isVirtual ? 'Virtual Event' : event.locationName}
              </span>
            </div>
          )}

          {/* RSVP count */}
          {goingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-vc-teal">
              <Users className="w-4 h-4" />
              <span>{goingCount} going</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
