'use client'

import { useEffect, useState } from 'react'
import type { EventRSVP, RSVPCounts } from '@/types/events'

interface Props {
  eventId: string
  counts?: RSVPCounts
}

const DEFAULT_COUNTS: RSVPCounts = { going: 0, maybe: 0, notGoing: 0 }

export default function EventGuestList({ eventId, counts: initialCounts }: Props) {
  const [rsvps, setRsvps] = useState<EventRSVP[]>([])
  const [counts, setCounts] = useState<RSVPCounts>(initialCounts || DEFAULT_COUNTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/events/${eventId}/rsvp`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setRsvps(data.rsvps || [])
          setCounts(data.counts || DEFAULT_COUNTS)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [eventId])

  const goingRsvps = rsvps.filter(r => r.status === 'going')
  const displayRsvps = goingRsvps.slice(0, 8)
  const remaining = goingRsvps.length - displayRsvps.length

  function getInitials(rsvp: EventRSVP): string {
    const name = rsvp.userName || rsvp.guestName || '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const colors = [
    'bg-vc-purple/40 ring-vc-purple/60',
    'bg-vc-teal/40 ring-vc-teal/60',
    'bg-vc-gold/40 ring-vc-gold/60',
    'bg-vc-coral/40 ring-vc-coral/60',
    'bg-vc-purple-light/40 ring-vc-purple-light/60',
  ]

  return (
    <div className="space-y-2">
      {/* Avatar row */}
      {displayRsvps.length > 0 && (
        <div className="flex items-center -space-x-2">
          {displayRsvps.map((rsvp, i) => (
            <div
              key={rsvp.id}
              className={`w-9 h-9 rounded-full ring-2 flex items-center justify-center text-xs font-bold text-white ${colors[i % colors.length]}`}
              title={rsvp.userName || rsvp.guestName || 'Guest'}
            >
              {getInitials(rsvp)}
            </div>
          ))}
          {remaining > 0 && (
            <div className="w-9 h-9 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center text-xs font-medium text-white/70">
              +{remaining}
            </div>
          )}
        </div>
      )}

      {/* Count text */}
      <div className="flex items-center gap-3 text-sm">
        {counts.going > 0 && (
          <span className="text-vc-teal font-medium">{counts.going} going</span>
        )}
        {counts.maybe > 0 && (
          <span className="text-vc-gold">{counts.maybe} maybe</span>
        )}
        {counts.going === 0 && counts.maybe === 0 && loaded && (
          <span className="text-white/40">No RSVPs yet — be the first!</span>
        )}
      </div>
    </div>
  )
}
